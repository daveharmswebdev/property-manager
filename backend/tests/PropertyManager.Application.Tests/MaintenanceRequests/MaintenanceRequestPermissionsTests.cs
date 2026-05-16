using FluentAssertions;
using PropertyManager.Domain.Authorization;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for MaintenanceRequest permission mappings (AC: #3, #4).
/// </summary>
public class MaintenanceRequestPermissionsTests
{
    [Fact]
    public void Owner_HasMaintenanceRequestsViewAll()
    {
        RolePermissions.Mappings["Owner"]
            .Should().Contain(Permissions.MaintenanceRequests.ViewAll);
    }

    [Fact]
    public void Tenant_DoesNotHaveMaintenanceRequestsViewAll()
    {
        RolePermissions.Mappings["Tenant"]
            .Should().NotContain(Permissions.MaintenanceRequests.ViewAll);
    }

    [Fact]
    public void Tenant_HasMaintenanceRequestsCreateAndViewOwn()
    {
        var tenantPermissions = RolePermissions.Mappings["Tenant"];
        tenantPermissions.Should().Contain(Permissions.MaintenanceRequests.Create);
        tenantPermissions.Should().Contain(Permissions.MaintenanceRequests.ViewOwn);
    }

    [Fact]
    public void RolePermissions_Owner_Has_DismissMaintenanceRequests()
    {
        RolePermissions.Mappings["Owner"]
            .Should().Contain(Permissions.MaintenanceRequests.Dismiss);
    }

    [Fact]
    public void RolePermissions_Tenant_DoesNotHave_DismissMaintenanceRequests()
    {
        RolePermissions.Mappings["Tenant"]
            .Should().NotContain(Permissions.MaintenanceRequests.Dismiss);
    }

    [Fact]
    public void RolePermissions_Contributor_DoesNotHave_DismissMaintenanceRequests()
    {
        RolePermissions.Mappings["Contributor"]
            .Should().NotContain(Permissions.MaintenanceRequests.Dismiss);
    }
}
