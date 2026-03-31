namespace PropertyManager.Domain.Authorization;

/// <summary>
/// Maps roles to their allowed permissions using HashSet for O(1) lookup.
/// Owner gets all permissions; Contributor gets a limited subset.
/// </summary>
public static class RolePermissions
{
    public static readonly IReadOnlyDictionary<string, HashSet<string>> Mappings =
        new Dictionary<string, HashSet<string>>
        {
            ["Owner"] = new HashSet<string>
            {
                // Properties
                Permissions.Properties.View,
                Permissions.Properties.ViewList,
                Permissions.Properties.Create,
                Permissions.Properties.Edit,
                Permissions.Properties.Delete,

                // Expenses
                Permissions.Expenses.View,
                Permissions.Expenses.Create,
                Permissions.Expenses.Edit,
                Permissions.Expenses.Delete,

                // Income
                Permissions.Income.View,
                Permissions.Income.Create,
                Permissions.Income.Edit,
                Permissions.Income.Delete,

                // Receipts
                Permissions.Receipts.ViewAll,
                Permissions.Receipts.Create,
                Permissions.Receipts.Edit,
                Permissions.Receipts.Delete,
                Permissions.Receipts.Process,

                // Work Orders
                Permissions.WorkOrders.View,
                Permissions.WorkOrders.Create,
                Permissions.WorkOrders.Edit,
                Permissions.WorkOrders.EditStatus,
                Permissions.WorkOrders.AddNotes,
                Permissions.WorkOrders.Delete,

                // Vendors
                Permissions.Vendors.View,
                Permissions.Vendors.Create,
                Permissions.Vendors.Edit,
                Permissions.Vendors.Delete,

                // Reports
                Permissions.Reports.View,
                Permissions.Reports.Generate,

                // Account
                Permissions.Account.View,
                Permissions.Account.Edit,

                // Users
                Permissions.Users.View,
                Permissions.Users.Invite,
                Permissions.Users.EditRole,
                Permissions.Users.Remove,
            },

            ["Contributor"] = new HashSet<string>
            {
                Permissions.Properties.ViewList,
                Permissions.Receipts.ViewAll,
                Permissions.Receipts.Create,
                Permissions.WorkOrders.View,
                Permissions.WorkOrders.EditStatus,
                Permissions.WorkOrders.AddNotes,
            },
        };
}
