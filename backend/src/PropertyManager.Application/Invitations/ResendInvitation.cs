using System.Security.Cryptography;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Command to resend an expired invitation (AC: #4).
/// Creates a new invitation record with a fresh code and expiry.
/// </summary>
public record ResendInvitationCommand(Guid InvitationId) : IRequest<ResendInvitationResult>;

/// <summary>
/// Result of resending an invitation.
/// </summary>
public record ResendInvitationResult(Guid InvitationId, string Message);

/// <summary>
/// Handler for ResendInvitationCommand.
/// Validates the original invitation, then creates a new one with fresh code/expiry.
/// </summary>
public class ResendInvitationCommandHandler : IRequestHandler<ResendInvitationCommand, ResendInvitationResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IEmailService _emailService;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<ResendInvitationCommandHandler> _logger;

    public ResendInvitationCommandHandler(
        IAppDbContext dbContext,
        IEmailService emailService,
        ICurrentUser currentUser,
        ILogger<ResendInvitationCommandHandler> logger)
    {
        _dbContext = dbContext;
        _emailService = emailService;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<ResendInvitationResult> Handle(ResendInvitationCommand request, CancellationToken cancellationToken)
    {
        // Load original invitation
        var original = await _dbContext.Invitations
            .Where(i => i.Id == request.InvitationId && i.AccountId == _currentUser.AccountId)
            .FirstOrDefaultAsync(cancellationToken);

        if (original == null)
        {
            throw new NotFoundException(nameof(Invitation), request.InvitationId);
        }

        // Verify it's used — cannot resend used invitations
        if (original.UsedAt != null)
        {
            throw new FluentValidation.ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("InvitationId", "Cannot resend an invitation that has already been used")
            });
        }

        // Verify it's expired — can only resend expired invitations
        if (original.ExpiresAt >= DateTime.UtcNow)
        {
            throw new FluentValidation.ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("InvitationId", "Can only resend expired invitations")
            });
        }

        // Generate new secure code
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        // Create new invitation record
        var newInvitation = new Invitation
        {
            Email = original.Email,
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            AccountId = _currentUser.AccountId,
            InvitedByUserId = _currentUser.UserId,
            Role = original.Role
        };

        _dbContext.Invitations.Add(newInvitation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Send invitation email
        await _emailService.SendInvitationEmailAsync(original.Email, rawCode, cancellationToken);

        _logger.LogInformation("Resent invitation. New ID: {InvitationId} (original: {OriginalId})",
            newInvitation.Id, original.Id);

        return new ResendInvitationResult(newInvitation.Id, "Invitation resent successfully");
    }

    private static string GenerateSecureCode()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static string ComputeHash(string code)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToBase64String(hashBytes);
    }
}
