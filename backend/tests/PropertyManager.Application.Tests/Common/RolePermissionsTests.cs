using System.Reflection;
using FluentAssertions;
using PropertyManager.Domain.Authorization;

namespace PropertyManager.Application.Tests.Common;

/// <summary>
/// Unit tests for RolePermissions mapping integrity (AC: #1, #2).
/// Uses reflection to ensure mappings stay in sync with permission constants.
/// </summary>
public class RolePermissionsTests
{
    /// <summary>
    /// Gets all string constants from the Permissions class via reflection.
    /// </summary>
    private static HashSet<string> GetAllPermissionConstants()
    {
        return typeof(Permissions)
            .GetNestedTypes()
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
                .Where(f => f.IsLiteral && !f.IsInitOnly && f.FieldType == typeof(string))
                .Select(f => (string)f.GetRawConstantValue()!))
            .ToHashSet();
    }

    // AC: #1 — Owner mapping contains ALL permission constants
    [Fact]
    public void OwnerMapping_ContainsAllPermissions()
    {
        var allPermissions = GetAllPermissionConstants();
        var ownerPermissions = RolePermissions.Mappings["Owner"];

        ownerPermissions.Should().BeEquivalentTo(allPermissions,
            because: "Owner role should have every permission defined in the Permissions class");
    }

    // AC: #2 — Contributor mapping contains exactly the 6 expected permissions
    [Fact]
    public void ContributorMapping_ContainsExactlyExpectedPermissions()
    {
        var expectedPermissions = new HashSet<string>
        {
            Permissions.Properties.ViewList,
            Permissions.Receipts.ViewAll,
            Permissions.Receipts.Create,
            Permissions.WorkOrders.View,
            Permissions.WorkOrders.EditStatus,
            Permissions.WorkOrders.AddNotes,
        };

        var contributorPermissions = RolePermissions.Mappings["Contributor"];

        contributorPermissions.Should().BeEquivalentTo(expectedPermissions,
            because: "Contributor role should have exactly the 6 specified permissions");
    }

    // Integrity — Every mapped permission string exists as a constant in Permissions class
    [Fact]
    public void AllMappedPermissions_ExistInPermissionsClass()
    {
        var allPermissions = GetAllPermissionConstants();

        foreach (var (role, permissions) in RolePermissions.Mappings)
        {
            foreach (var permission in permissions)
            {
                allPermissions.Should().Contain(permission,
                    because: $"permission '{permission}' in role '{role}' should exist as a constant in the Permissions class");
            }
        }
    }
}
