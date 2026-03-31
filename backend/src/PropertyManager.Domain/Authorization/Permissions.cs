namespace PropertyManager.Domain.Authorization;

/// <summary>
/// Defines granular permission constants organized by entity.
/// Used by RolePermissions to map roles to allowed operations.
/// </summary>
public static class Permissions
{
    public static class Properties
    {
        public const string View = "Properties.View";
        public const string ViewList = "Properties.ViewList";
        public const string Create = "Properties.Create";
        public const string Edit = "Properties.Edit";
        public const string Delete = "Properties.Delete";
    }

    public static class Expenses
    {
        public const string View = "Expenses.View";
        public const string Create = "Expenses.Create";
        public const string Edit = "Expenses.Edit";
        public const string Delete = "Expenses.Delete";
    }

    public static class Income
    {
        public const string View = "Income.View";
        public const string Create = "Income.Create";
        public const string Edit = "Income.Edit";
        public const string Delete = "Income.Delete";
    }

    public static class Receipts
    {
        public const string ViewAll = "Receipts.ViewAll";
        public const string Create = "Receipts.Create";
        public const string Edit = "Receipts.Edit";
        public const string Delete = "Receipts.Delete";
        public const string Process = "Receipts.Process";
    }

    public static class WorkOrders
    {
        public const string View = "WorkOrders.View";
        public const string Create = "WorkOrders.Create";
        public const string Edit = "WorkOrders.Edit";
        public const string EditStatus = "WorkOrders.EditStatus";
        public const string AddNotes = "WorkOrders.AddNotes";
        public const string Delete = "WorkOrders.Delete";
    }

    public static class Vendors
    {
        public const string View = "Vendors.View";
        public const string Create = "Vendors.Create";
        public const string Edit = "Vendors.Edit";
        public const string Delete = "Vendors.Delete";
    }

    public static class Reports
    {
        public const string View = "Reports.View";
        public const string Generate = "Reports.Generate";
    }

    public static class Account
    {
        public const string View = "Account.View";
        public const string Edit = "Account.Edit";
    }

    public static class Users
    {
        public const string View = "Users.View";
        public const string Invite = "Users.Invite";
        public const string EditRole = "Users.EditRole";
        public const string Remove = "Users.Remove";
    }
}
