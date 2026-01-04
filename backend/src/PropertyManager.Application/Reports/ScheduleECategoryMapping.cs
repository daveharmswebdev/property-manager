namespace PropertyManager.Application.Reports;

/// <summary>
/// Maps expense categories to their corresponding IRS Schedule E line numbers.
/// Per IRS Form 1040 Schedule E (Supplemental Income and Loss).
/// </summary>
public static class ScheduleECategoryMapping
{
    /// <summary>
    /// Mapping of expense category names to Schedule E line numbers.
    /// Line numbers 5-19 correspond to specific expense types.
    /// </summary>
    public static readonly Dictionary<string, int> CategoryToLine = new()
    {
        { "Advertising", 5 },
        { "Auto and Travel", 6 },
        { "Cleaning and Maintenance", 7 },
        { "Commissions", 8 },
        { "Insurance", 9 },
        { "Legal and Professional Fees", 10 },
        { "Management Fees", 11 },
        { "Mortgage Interest", 12 },
        { "Other Interest", 13 },
        { "Repairs", 14 },
        { "Supplies", 15 },
        { "Taxes", 16 },
        { "Utilities", 17 },
        { "Depreciation", 18 },
        { "Other", 19 }
    };

    /// <summary>
    /// Gets the Schedule E line number for a category name.
    /// Returns 19 (Other) if category is not found.
    /// </summary>
    public static int GetLineNumber(string categoryName)
    {
        return CategoryToLine.TryGetValue(categoryName, out var line) ? line : 19;
    }
}
