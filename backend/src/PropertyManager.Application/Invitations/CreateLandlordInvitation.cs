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
/// Command to invite a new top-level landlord — creates an Invitation with AccountId=null
/// (AC: 22.2 #1). AcceptInvitation already branches on AccountId.HasValue and will provision
/// a fresh Account + Owner user when this invitation is accepted (Story 19.1).
///
/// NFR-LP2 SEAM: This handler is intentionally permission-agnostic. The PlatformAdmin gate
/// lives only on AdminLandlordInvitationsController via [Authorize(Policy = "CanInviteLandlords")].
/// A future public POST /api/v1/signup can dispatch this same command without modification.
/// </summary>
public record CreateLandlordInvitationCommand(string Email)
    : IRequest<CreateLandlordInvitationResult>;

/// <summary>
/// Result of landlord invitation creation.
/// </summary>
public record CreateLandlordInvitationResult(Guid InvitationId, string Message);

/// <summary>
/// Handler for <see cref="CreateLandlordInvitationCommand"/>.
/// Generates a secure invitation code, persists an <see cref="Invitation"/> with
/// AccountId=null and Role="Owner", and triggers a landlord-flavored email.
/// </summary>
public class CreateLandlordInvitationCommandHandler
    : IRequestHandler<CreateLandlordInvitationCommand, CreateLandlordInvitationResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IIdentityService _identityService;
    private readonly IEmailService _emailService;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<CreateLandlordInvitationCommandHandler> _logger;

    public CreateLandlordInvitationCommandHandler(
        IAppDbContext dbContext,
        IIdentityService identityService,
        IEmailService emailService,
        ICurrentUser currentUser,
        ILogger<CreateLandlordInvitationCommandHandler> logger)
    {
        _dbContext = dbContext;
        _identityService = identityService;
        _emailService = emailService;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<CreateLandlordInvitationResult> Handle(
        CreateLandlordInvitationCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // AC: 22.2 #4 — Email already mapped to a registered user → 400
        if (await _identityService.EmailExistsAsync(email, cancellationToken))
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email is already registered")
            });
        }

        // AC: 22.2 #5 — Non-expired, unused invitation (of any flavor) already pending → 400
        var pending = await _dbContext.Invitations
            .Where(i => i.Email == email && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(cancellationToken);

        if (pending != null)
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email already has a pending invitation")
            });
        }

        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        // AC: 22.2 #1 — AccountId=null + Role="Owner" + PropertyId=null + InvitedByUserId=caller
        var invitation = new Invitation
        {
            Email = email,
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            AccountId = null,
            InvitedByUserId = _currentUser.UserId,
            Role = "Owner",
            PropertyId = null
        };

        _dbContext.Invitations.Add(invitation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // AC: 22.2 #6 — landlord-flavored email, not co-owner or tenant
        await _emailService.SendLandlordInvitationEmailAsync(email, rawCode, cancellationToken);

        // AC: 22.2 #10 — log carries InvitationId + InvitedByUserId + masked email; raw email/code never logged
        _logger.LogInformation(
            "Landlord invitation created. InvitationId: {InvitationId}, InvitedByUserId: {InvitedByUserId}, Email: {Email}",
            invitation.Id,
            _currentUser.UserId,
            LogSanitizer.MaskEmail(email));

        return new CreateLandlordInvitationResult(invitation.Id, "Landlord invitation sent successfully");
    }

    /// <summary>
    /// Generates a cryptographically secure invitation code (32 random bytes → base64-url).
    /// Co-located rather than shared with CreateInvitation per story Dev Notes (acceptable duplication).
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
