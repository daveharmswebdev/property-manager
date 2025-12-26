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
