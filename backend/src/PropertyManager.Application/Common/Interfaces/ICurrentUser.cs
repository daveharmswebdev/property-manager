namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for accessing current user context.
/// Used by AppDbContext for tenant filtering.
/// Implementation in Infrastructure layer.
/// </summary>
public interface ICurrentUser
{
    Guid UserId { get; }
    Guid AccountId { get; }
    string Role { get; }
    Guid? PropertyId { get; }
    bool IsAuthenticated { get; }

    /// <summary>
    /// True when the request JWT carries the platform-level "platformAdmin"="true" claim
    /// (Story 22.1). Orthogonal to <see cref="Role"/> — a user can simultaneously be
    /// per-account Owner and platform-wide PlatformAdmin.
    /// </summary>
    bool IsPlatformAdmin { get; }
}
