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
}
