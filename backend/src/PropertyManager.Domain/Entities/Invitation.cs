namespace PropertyManager.Domain.Entities;

/// <summary>
/// Represents an email invitation for user registration.
/// Invitations expire after 24 hours and are single-use.
/// </summary>
public class Invitation
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Email address the invitation was sent to.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Hashed invitation code for security.
    /// The raw code is only sent via email, never stored.
    /// </summary>
    public string CodeHash { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when the invitation was created.
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Timestamp when the invitation expires (24 hours after creation).
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Timestamp when the invitation was used (null if not used).
    /// </summary>
    public DateTime? UsedAt { get; set; }

    /// <summary>
    /// The account the invitee will join. Null means create a new account (legacy flow).
    /// </summary>
    public Guid? AccountId { get; set; }

    /// <summary>
    /// The role assigned to the invitee. Defaults to "Owner".
    /// </summary>
    public string Role { get; set; } = "Owner";

    /// <summary>
    /// The user who sent the invitation. Null for legacy invitations.
    /// </summary>
    public Guid? InvitedByUserId { get; set; }

    /// <summary>
    /// The property the invitee is associated with. Only set for Tenant invitations.
    /// </summary>
    public Guid? PropertyId { get; set; }

    /// <summary>
    /// Navigation property for the associated property. Only set for Tenant invitations.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// Checks if the invitation is expired.
    /// </summary>
    public bool IsExpired => DateTime.UtcNow > ExpiresAt;

    /// <summary>
    /// Checks if the invitation has been used.
    /// </summary>
    public bool IsUsed => UsedAt.HasValue;

    /// <summary>
    /// Checks if the invitation is valid (not expired and not used).
    /// </summary>
    public bool IsValid => !IsExpired && !IsUsed;
}
