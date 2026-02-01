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
/// Command for creating an invitation to register.
/// Only owners can create invitations (AC: TD.6.3).
/// </summary>
public record CreateInvitationCommand(string Email) : IRequest<CreateInvitationResult>;

/// <summary>
/// Result of invitation creation.
/// </summary>
public record CreateInvitationResult(
    Guid InvitationId,
    string Message
);

/// <summary>
/// Validator for CreateInvitationCommand.
/// </summary>
public class CreateInvitationCommandValidator : AbstractValidator<CreateInvitationCommand>
{
    public CreateInvitationCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");
    }
}

/// <summary>
/// Handler for CreateInvitationCommand.
/// Generates a secure invitation code, saves it, and triggers email.
/// </summary>
public class CreateInvitationCommandHandler : IRequestHandler<CreateInvitationCommand, CreateInvitationResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IIdentityService _identityService;
    private readonly IEmailService _emailService;
    private readonly ILogger<CreateInvitationCommandHandler> _logger;

    public CreateInvitationCommandHandler(
        IAppDbContext dbContext,
        IIdentityService identityService,
        IEmailService emailService,
        ILogger<CreateInvitationCommandHandler> logger)
    {
        _dbContext = dbContext;
        _identityService = identityService;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<CreateInvitationResult> Handle(CreateInvitationCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // Check if email is already registered (AC: TD.6.3)
        if (await _identityService.EmailExistsAsync(email, cancellationToken))
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email is already registered")
            });
        }

        // Check for existing pending invitation (AC: TD.6.3)
        var existingInvitation = await _dbContext.Invitations
            .Where(i => i.Email == email && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingInvitation != null)
        {
            throw new ValidationException(new[]
            {
                new FluentValidation.Results.ValidationFailure("Email", "This email already has a pending invitation")
            });
        }

        // Generate secure invitation code
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        // Create invitation entity (AC: TD.6.2)
        var invitation = new Invitation
        {
            Email = email,
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24) // 24-hour expiration per AC: TD.6.2
        };

        _dbContext.Invitations.Add(invitation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Send invitation email (AC: TD.6.5)
        await _emailService.SendInvitationEmailAsync(email, rawCode, cancellationToken);

        _logger.LogInformation("Invitation created for {Email}, ID: {InvitationId}", LogSanitizer.MaskEmail(email), invitation.Id);

        return new CreateInvitationResult(invitation.Id, "Invitation sent successfully");
    }

    /// <summary>
    /// Generates a cryptographically secure invitation code.
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
