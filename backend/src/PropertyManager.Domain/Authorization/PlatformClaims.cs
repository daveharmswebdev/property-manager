namespace PropertyManager.Domain.Authorization;

/// <summary>
/// Platform-wide claim type constants (orthogonal to per-account roles).
/// These claims are stored in AspNetUserClaims and surfaced into the JWT
/// by JwtService so authorization can be stateless.
/// </summary>
/// <remarks>
/// Story 22.1 — PlatformAdmin is intentionally NOT modeled as a role on
/// ApplicationUser.Role (which is per-account: Owner/Contributor/Tenant).
/// A user can be Owner of their own account AND PlatformAdmin of the platform.
/// </remarks>
public static class PlatformClaims
{
    /// <summary>
    /// Identifies a platform-level administrator authorized to provision
    /// new landlord accounts (Epic 22). Carried in JWT as "platformAdmin"="true".
    /// </summary>
    public const string PlatformAdmin = "platformAdmin";
}
