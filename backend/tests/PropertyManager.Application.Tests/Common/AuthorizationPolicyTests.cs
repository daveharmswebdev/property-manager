using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;

namespace PropertyManager.Application.Tests.Common;

/// <summary>
/// Verifies that all policy names used in [Authorize(Policy = "...")] attributes
/// on controllers are actually registered as authorization policies in Program.cs.
/// </summary>
public class AuthorizationPolicyTests
{
    /// <summary>
    /// The set of policy names registered in Program.cs via AddPermissionPolicy().
    /// Keep in sync with the actual registrations in Program.cs.
    /// </summary>
    private static readonly HashSet<string> RegisteredPolicies = new()
    {
        "CanManageProperties",
        "CanViewProperties",
        "CanAccessExpenses",
        "CanAccessIncome",
        "CanAccessVendors",
        "CanAccessReceipts",
        "CanProcessReceipts",
        "CanManageWorkOrders",
        "CanViewWorkOrders",
        "CanAccessReports",
        "CanManageUsers",
        "CanCreateMaintenanceRequests"
    };

    [Fact]
    public void AllPolicyNamesInAuthorizeAttributes_AreRegistered()
    {
        // Arrange — scan all controllers in the Api assembly for [Authorize(Policy = "...")] attributes
        var apiAssembly = Assembly.Load("PropertyManager.Api");
        var controllerTypes = apiAssembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && t.Name.EndsWith("Controller"));

        var policyNamesInAttributes = new HashSet<string>();

        foreach (var controllerType in controllerTypes)
        {
            // Check class-level [Authorize] attributes
            var classAttributes = controllerType.GetCustomAttributes<AuthorizeAttribute>(inherit: true);
            foreach (var attr in classAttributes)
            {
                if (!string.IsNullOrEmpty(attr.Policy))
                {
                    policyNamesInAttributes.Add(attr.Policy);
                }
            }

            // Check action-level [Authorize] attributes
            var methods = controllerType.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
            foreach (var method in methods)
            {
                var methodAttributes = method.GetCustomAttributes<AuthorizeAttribute>(inherit: true);
                foreach (var attr in methodAttributes)
                {
                    if (!string.IsNullOrEmpty(attr.Policy))
                    {
                        policyNamesInAttributes.Add(attr.Policy);
                    }
                }
            }
        }

        // Act & Assert — every policy name found in attributes must be in the registered set
        policyNamesInAttributes.Should().NotBeEmpty("at least one policy should be used in controller attributes");

        foreach (var policyName in policyNamesInAttributes)
        {
            RegisteredPolicies.Should().Contain(policyName,
                $"policy '{policyName}' is used in an [Authorize] attribute but is not registered in Program.cs");
        }
    }

    [Fact]
    public void AllRegisteredPolicies_AreUsedInAtLeastOneAttribute()
    {
        // Arrange — verify no registered policy is orphaned (registered but never used)
        var apiAssembly = Assembly.Load("PropertyManager.Api");
        var controllerTypes = apiAssembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && t.Name.EndsWith("Controller"));

        var policyNamesInAttributes = new HashSet<string>();

        foreach (var controllerType in controllerTypes)
        {
            var classAttributes = controllerType.GetCustomAttributes<AuthorizeAttribute>(inherit: true);
            foreach (var attr in classAttributes)
            {
                if (!string.IsNullOrEmpty(attr.Policy))
                {
                    policyNamesInAttributes.Add(attr.Policy);
                }
            }

            var methods = controllerType.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
            foreach (var method in methods)
            {
                var methodAttributes = method.GetCustomAttributes<AuthorizeAttribute>(inherit: true);
                foreach (var attr in methodAttributes)
                {
                    if (!string.IsNullOrEmpty(attr.Policy))
                    {
                        policyNamesInAttributes.Add(attr.Policy);
                    }
                }
            }
        }

        // Act & Assert — every registered policy should be used somewhere
        foreach (var registeredPolicy in RegisteredPolicies)
        {
            policyNamesInAttributes.Should().Contain(registeredPolicy,
                $"policy '{registeredPolicy}' is registered but not used in any [Authorize] attribute");
        }
    }
}
