namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Service for checking role-based permissions of the current user.
/// Implementation in Infrastructure layer uses ICurrentUser and RolePermissions mappings.
/// </summary>
public interface IPermissionService
{
    bool HasPermission(string permission);
    bool IsOwner();
    bool IsContributor();
    bool IsTenant();

    /// <summary>
    /// True when the current user carries the "platformAdmin"="true" claim (Story 22.1).
    /// Orthogonal to the per-account role — does NOT key into <see cref="HasPermission"/>.
    /// </summary>
    bool IsPlatformAdmin();
}
