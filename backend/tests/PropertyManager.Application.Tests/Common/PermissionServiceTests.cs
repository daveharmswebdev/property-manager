using FluentAssertions;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Authorization;
using PropertyManager.Infrastructure.Identity;

namespace PropertyManager.Application.Tests.Common;

/// <summary>
/// Unit tests for PermissionService (AC: #1, #2, #3, #4, #5).
/// </summary>
public class PermissionServiceTests
{
    private readonly Mock<ICurrentUser> _mockCurrentUser;

    public PermissionServiceTests()
    {
        _mockCurrentUser = new Mock<ICurrentUser>();
    }

    private PermissionService CreateService(string role)
    {
        _mockCurrentUser.Setup(x => x.Role).Returns(role);
        return new PermissionService(_mockCurrentUser.Object);
    }

    // AC: #3 — Owner has Expenses.View permission
    [Fact]
    public void HasPermission_OwnerWithExpensesView_ReturnsTrue()
    {
        var service = CreateService("Owner");

        var result = service.HasPermission(Permissions.Expenses.View);

        result.Should().BeTrue();
    }

    // AC: #4 — Contributor does NOT have Expenses.View permission
    [Fact]
    public void HasPermission_ContributorWithExpensesView_ReturnsFalse()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.Expenses.View);

        result.Should().BeFalse();
    }

    // AC: #1 — Owner has ALL permissions
    [Fact]
    public void HasPermission_OwnerWithAllPermissions_ReturnsTrue()
    {
        var service = CreateService("Owner");

        // Verify Owner has every single permission constant
        var allPermissions = GetAllPermissionConstants();
        foreach (var permission in allPermissions)
        {
            service.HasPermission(permission).Should().BeTrue(
                because: $"Owner should have permission '{permission}'");
        }
    }

    // AC: #2 — Contributor has Properties.ViewList
    [Fact]
    public void HasPermission_ContributorWithPropertiesViewList_ReturnsTrue()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.Properties.ViewList);

        result.Should().BeTrue();
    }

    // AC: #2 — Contributor does NOT have Properties.Create
    [Fact]
    public void HasPermission_ContributorWithPropertiesCreate_ReturnsFalse()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.Properties.Create);

        result.Should().BeFalse();
    }

    // AC: #2 — Contributor has Receipts.ViewAll
    [Fact]
    public void HasPermission_ContributorWithReceiptsViewAll_ReturnsTrue()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.Receipts.ViewAll);

        result.Should().BeTrue();
    }

    // AC: #2 — Contributor does NOT have Receipts.Process
    [Fact]
    public void HasPermission_ContributorWithReceiptsProcess_ReturnsFalse()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.Receipts.Process);

        result.Should().BeFalse();
    }

    // AC: #2 — Contributor has WorkOrders.View
    [Fact]
    public void HasPermission_ContributorWithWorkOrdersView_ReturnsTrue()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.WorkOrders.View);

        result.Should().BeTrue();
    }

    // AC: #2 — Contributor does NOT have WorkOrders.Create
    [Fact]
    public void HasPermission_ContributorWithWorkOrdersCreate_ReturnsFalse()
    {
        var service = CreateService("Contributor");

        var result = service.HasPermission(Permissions.WorkOrders.Create);

        result.Should().BeFalse();
    }

    // AC: #5 — IsOwner returns true for Owner role
    [Fact]
    public void IsOwner_WhenRoleIsOwner_ReturnsTrue()
    {
        var service = CreateService("Owner");

        var result = service.IsOwner();

        result.Should().BeTrue();
    }

    // AC: #5 — IsOwner returns false for Contributor role
    [Fact]
    public void IsOwner_WhenRoleIsContributor_ReturnsFalse()
    {
        var service = CreateService("Contributor");

        var result = service.IsOwner();

        result.Should().BeFalse();
    }

    // AC: #5 — IsContributor returns true for Contributor role
    [Fact]
    public void IsContributor_WhenRoleIsContributor_ReturnsTrue()
    {
        var service = CreateService("Contributor");

        var result = service.IsContributor();

        result.Should().BeTrue();
    }

    // AC: #5 — IsContributor returns false for Owner role
    [Fact]
    public void IsContributor_WhenRoleIsOwner_ReturnsFalse()
    {
        var service = CreateService("Owner");

        var result = service.IsContributor();

        result.Should().BeFalse();
    }

    // Edge case — Unknown role returns false
    [Fact]
    public void HasPermission_UnknownRole_ReturnsFalse()
    {
        var service = CreateService("UnknownRole");

        var result = service.HasPermission(Permissions.Properties.View);

        result.Should().BeFalse();
    }

    // Edge case — Empty permission string returns false
    [Fact]
    public void HasPermission_EmptyPermission_ReturnsFalse()
    {
        var service = CreateService("Owner");

        var result = service.HasPermission(string.Empty);

        result.Should().BeFalse();
    }

    /// <summary>
    /// Helper to get all permission constants via reflection.
    /// </summary>
    private static IEnumerable<string> GetAllPermissionConstants()
    {
        return typeof(Permissions)
            .GetNestedTypes()
            .SelectMany(t => t.GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.FlattenHierarchy)
                .Where(f => f.IsLiteral && !f.IsInitOnly && f.FieldType == typeof(string))
                .Select(f => (string)f.GetRawConstantValue()!));
    }
}
