using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Identity;

/// <summary>
/// ASP.NET Core Identity user with custom properties for multi-tenancy.
/// Links to Account for tenant isolation.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>
    /// Foreign key to the Account (tenant boundary).
    /// </summary>
    public Guid AccountId { get; set; }

    /// <summary>
    /// User role within the account: "Owner", "Contributor", or "Tenant".
    /// </summary>
    public string Role { get; set; } = "Owner";

    /// <summary>
    /// Timestamp when the user was created.
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Timestamp when the user was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// User's display name shown in the UI. Falls back to email if not set.
    /// </summary>
    [MaxLength(100)]
    public string? DisplayName { get; set; }

    /// <summary>
    /// Foreign key to the Property (tenant-to-property scoping).
    /// Nullable — only set for users with the Tenant role.
    /// </summary>
    public Guid? PropertyId { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;

    /// <summary>
    /// The property assigned to this tenant user. Null for Owner/Contributor users.
    /// </summary>
    public Property? AssignedProperty { get; set; }
}
