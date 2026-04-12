using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Authorization;

namespace PropertyManager.Infrastructure.Identity;

/// <summary>
/// Checks role-based permissions for the current user by looking up
/// their role in the RolePermissions mappings.
/// </summary>
public class PermissionService : IPermissionService
{
    private readonly ICurrentUser _currentUser;

    public PermissionService(ICurrentUser currentUser)
    {
        _currentUser = currentUser;
    }

    public bool HasPermission(string permission)
    {
        if (string.IsNullOrEmpty(permission))
            return false;

        var role = _currentUser.Role;
        if (string.IsNullOrEmpty(role))
            return false;

        return RolePermissions.Mappings.TryGetValue(role, out var permissions)
            && permissions.Contains(permission);
    }

    public bool IsOwner() => string.Equals(_currentUser.Role, "Owner", StringComparison.Ordinal);

    public bool IsContributor() => string.Equals(_currentUser.Role, "Contributor", StringComparison.Ordinal);

    public bool IsTenant() => string.Equals(_currentUser.Role, "Tenant", StringComparison.Ordinal);
}
