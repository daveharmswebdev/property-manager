namespace PropertyManager.Domain.Entities;

/// <summary>
/// Global expense category for IRS Schedule E line items.
/// No AccountId - these are seed data, not user-editable.
/// Supports hierarchy with ParentId per Architecture ADR #23.
/// </summary>
public class ExpenseCategory
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ScheduleELine { get; set; }
    public int SortOrder { get; set; }

    /// <summary>
    /// FK to parent category for hierarchy support.
    /// NULL means this is a top-level category.
    /// </summary>
    public Guid? ParentId { get; set; }

    // Navigation properties
    public ExpenseCategory? Parent { get; set; }
    public ICollection<ExpenseCategory> Children { get; set; } = new List<ExpenseCategory>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    public ICollection<CategoryTradeTagMapping> TradeTagMappings { get; set; } = new List<CategoryTradeTagMapping>();
    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
}
