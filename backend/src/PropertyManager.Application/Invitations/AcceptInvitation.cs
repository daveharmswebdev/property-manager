using System.Security.Cryptography;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Command for accepting an invitation and creating an account.
/// </summary>
public record AcceptInvitationCommand(
    string Code,
    string Password
) : IRequest<AcceptInvitationResult>;

/// <summary>
/// Result of invitation acceptance.
/// </summary>
public record AcceptInvitationResult(
    Guid UserId,
    string Email,
    string Message
);

/// <summary>
/// Handler for AcceptInvitationCommand.
/// Creates user account and marks invitation as used.
/// </summary>
public class AcceptInvitationCommandHandler : IRequestHandler<AcceptInvitationCommand, AcceptInvitationResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IIdentityService _identityService;
    private readonly ILogger<AcceptInvitationCommandHandler> _logger;

    public AcceptInvitationCommandHandler(
        IAppDbContext dbContext,
        IIdentityService identityService,
        ILogger<AcceptInvitationCommandHandler> logger)
    {
        _dbContext = dbContext;
        _identityService = identityService;
        _logger = logger;
    }

    public async Task<AcceptInvitationResult> Handle(AcceptInvitationCommand request, CancellationToken cancellationToken)
    {
        // Hash the code to look up in database
        var codeHash = ComputeHash(request.Code);

        // Find and validate invitation
        var invitation = await _dbContext.Invitations
            .FirstOrDefaultAsync(i => i.CodeHash == codeHash, cancellationToken);

        if (invitation == null)
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Code", "Invalid invitation code")
            });
        }

        // Check if used (AC: TD.6.2)
        if (invitation.IsUsed)
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Code", "This invitation has already been used")
            });
        }

        // Check if expired (AC: TD.6.2)
        if (invitation.IsExpired)
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Code", "This invitation has expired")
            });
        }

        // Double-check email isn't already registered (race condition protection)
        if (await _identityService.EmailExistsAsync(invitation.Email, cancellationToken))
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email is already registered")
            });
        }

        // Determine account and role based on invitation type
        Guid accountId;
        string role;
        Account? newAccount = null;

        if (invitation.AccountId.HasValue)
        {
            // Join existing account (new RBAC flow)
            accountId = invitation.AccountId.Value;
            role = invitation.Role;
        }
        else
        {
            // Create new account (legacy/standalone flow — preserves curl workflow)
            newAccount = new Account { Name = $"{invitation.Email}'s Account" };
            _dbContext.Accounts.Add(newAccount);
            await _dbContext.SaveChangesAsync(cancellationToken);
            accountId = newAccount.Id;
            role = "Owner";
        }

        // Create User via Identity with assigned role and pre-confirmed email (AC: TD.6.6)
        var (userId, errors) = await _identityService.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            request.Password,
            accountId,
            role,
            cancellationToken);

        if (userId is null)
        {
            // Rollback only if we created a new account
            if (newAccount is not null)
            {
                _dbContext.Accounts.Remove(newAccount);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            throw new ValidationException(
                errors.Select(e => new FluentValidation.Results.ValidationFailure("Password", e)));
        }

        // Mark invitation as used (AC: TD.6.2)
        invitation.UsedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        var message = invitation.AccountId.HasValue
            ? "Successfully joined account"
            : "Account created successfully";

        _logger.LogInformation("Invitation accepted for {Email}, UserId: {UserId}, JoinedExisting: {JoinedExisting}",
            LogSanitizer.MaskEmail(invitation.Email), userId, invitation.AccountId.HasValue);

        return new AcceptInvitationResult(userId.Value, invitation.Email, message);
    }

    /// <summary>
    /// Computes SHA256 hash of the code for lookup.
    /// </summary>
    private static string ComputeHash(string code)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToBase64String(hashBytes);
    }
}
