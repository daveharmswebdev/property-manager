using System.Security.Cryptography;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
/// Validator for AcceptInvitationCommand.
/// </summary>
public class AcceptInvitationCommandValidator : AbstractValidator<AcceptInvitationCommand>
{
    public AcceptInvitationCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Invitation code is required");

        // Password requirements matching Register.cs (AC3.2)
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters")
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter")
            .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter")
            .Matches("[0-9]").WithMessage("Password must contain at least one number")
            .Matches(@"[!@#$%^&*()_+\-=\[\]{}|;':"",./<>?]").WithMessage("Password must contain at least one special character");
    }
}

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

        // Create Account entity (same as Register.cs)
        var account = new Account
        {
            Name = $"{invitation.Email}'s Account"
        };
        _dbContext.Accounts.Add(account);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Create User via Identity with "Owner" role and pre-confirmed email (AC: TD.6.6)
        var (userId, errors) = await _identityService.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            request.Password,
            account.Id,
            "Owner",
            cancellationToken);

        if (userId is null)
        {
            // Rollback account creation
            _dbContext.Accounts.Remove(account);
            await _dbContext.SaveChangesAsync(cancellationToken);

            throw new ValidationException(
                errors.Select(e => new FluentValidation.Results.ValidationFailure("Password", e)));
        }

        // Mark invitation as used (AC: TD.6.2)
        invitation.UsedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Invitation accepted for {Email}, UserId: {UserId}", invitation.Email, userId);

        return new AcceptInvitationResult(userId.Value, invitation.Email, "Account created successfully");
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
