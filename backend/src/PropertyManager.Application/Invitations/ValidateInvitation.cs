using System.Security.Cryptography;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Query for validating an invitation code.
/// Used to check if a code is valid before showing the accept form.
/// </summary>
public record ValidateInvitationQuery(string Code) : IRequest<ValidateInvitationResult>;

/// <summary>
/// Result of invitation validation.
/// </summary>
public record ValidateInvitationResult(
    bool IsValid,
    string? Email,
    string? Role,
    string? ErrorMessage,
    Guid? PropertyId = null,
    string? PropertyAddress = null
);

/// <summary>
/// Handler for ValidateInvitationQuery.
/// Checks if the invitation code is valid, not expired, and not used.
/// </summary>
public class ValidateInvitationQueryHandler : IRequestHandler<ValidateInvitationQuery, ValidateInvitationResult>
{
    private readonly IAppDbContext _dbContext;

    public ValidateInvitationQueryHandler(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ValidateInvitationResult> Handle(ValidateInvitationQuery request, CancellationToken cancellationToken)
    {
        // Hash the code to look up in database
        var codeHash = ComputeHash(request.Code);

        // Find invitation by code hash
        var invitation = await _dbContext.Invitations
            .FirstOrDefaultAsync(i => i.CodeHash == codeHash, cancellationToken);

        if (invitation == null)
        {
            return new ValidateInvitationResult(false, null, null, "Invalid invitation code");
        }

        // Check if used (AC: TD.6.2)
        if (invitation.IsUsed)
        {
            return new ValidateInvitationResult(false, null, null, "This invitation has already been used");
        }

        // Check if expired (AC: TD.6.2)
        if (invitation.IsExpired)
        {
            return new ValidateInvitationResult(false, null, null, "This invitation has expired");
        }

        // Load property address for Tenant invitations (AC: 20.2 #4)
        string? propertyAddress = null;
        if (invitation.PropertyId.HasValue)
        {
            var property = await _dbContext.Properties
                .Where(p => p.Id == invitation.PropertyId.Value)
                .Select(p => new { p.Street, p.City, p.State, p.ZipCode })
                .FirstOrDefaultAsync(cancellationToken);

            if (property != null)
            {
                propertyAddress = $"{property.Street}, {property.City}, {property.State} {property.ZipCode}";
            }
        }

        // Valid invitation
        return new ValidateInvitationResult(true, invitation.Email, invitation.Role, null, invitation.PropertyId, propertyAddress);
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
