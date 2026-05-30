using System.Security.Cryptography;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Command to resend an expired landlord invitation (Story 22.4, AC: #6).
/// Looks up a landlord invitation (AccountId == null) and re-creates a fresh one.
///
/// NFR-LP2 SEAM: This handler is intentionally permission-agnostic. The PlatformAdmin
/// gate lives only on AdminLandlordInvitationsController via [Authorize(Policy =
/// "CanInviteLandlords")]. Kept distinct from the account-scoped ResendInvitationCommand
/// (which corrupts a landlord invitation by stamping the caller's AccountId and sending
/// the co-owner email).
/// </summary>
public record ResendLandlordInvitationCommand(Guid InvitationId)
    : IRequest<ResendLandlordInvitationResult>;

/// <summary>
/// Result of resending a landlord invitation.
/// </summary>
public record ResendLandlordInvitationResult(Guid InvitationId, string Message);

/// <summary>
/// Handler for <see cref="ResendLandlordInvitationCommand"/>.
/// Validates the original landlord invitation, then creates a new one with a fresh
/// code/expiry, AccountId == null, Role == "Owner", and sends the landlord email.
/// </summary>
public class ResendLandlordInvitationCommandHandler
    : IRequestHandler<ResendLandlordInvitationCommand, ResendLandlordInvitationResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IEmailService _emailService;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<ResendLandlordInvitationCommandHandler> _logger;

    public ResendLandlordInvitationCommandHandler(
        IAppDbContext dbContext,
        IEmailService emailService,
        ICurrentUser currentUser,
        ILogger<ResendLandlordInvitationCommandHandler> logger)
    {
        _dbContext = dbContext;
        _emailService = emailService;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<ResendLandlordInvitationResult> Handle(
        ResendLandlordInvitationCommand request, CancellationToken cancellationToken)
    {
        // Landlord invitations have AccountId == null — never serve an account-scoped one here.
        var original = await _dbContext.Invitations
            .Where(i => i.Id == request.InvitationId && i.AccountId == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (original == null)
        {
            throw new NotFoundException(nameof(Invitation), request.InvitationId);
        }

        if (original.UsedAt != null)
        {
            throw new FluentValidation.ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure(
                    "InvitationId", "Cannot resend an invitation that has already been used")
            });
        }

        if (original.ExpiresAt >= DateTime.UtcNow)
        {
            throw new FluentValidation.ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure(
                    "InvitationId", "Can only resend expired invitations")
            });
        }

        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        var newInvitation = new Invitation
        {
            Email = original.Email,
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            AccountId = null,
            InvitedByUserId = _currentUser.UserId,
            Role = "Owner",
            PropertyId = null
        };

        _dbContext.Invitations.Add(newInvitation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _emailService.SendLandlordInvitationEmailAsync(original.Email, rawCode, cancellationToken);

        // CWE-359 / cleartext-storage: no IDs or email in the log.
        _logger.LogInformation("Resent landlord invitation");

        return new ResendLandlordInvitationResult(newInvitation.Id, "Landlord invitation resent successfully");
    }

    /// <summary>
    /// Generates a cryptographically secure invitation code (32 random bytes → base64-url).
    /// Co-located per project convention (acceptable duplication across invitation handlers).
    /// </summary>
    private static string GenerateSecureCode()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    /// <summary>
    /// Computes SHA256 hash of the code for storage.
    /// </summary>
    private static string ComputeHash(string code)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToBase64String(hashBytes);
    }
}
