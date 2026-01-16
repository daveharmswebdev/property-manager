namespace PropertyManager.Domain.Entities;

/// <summary>
/// Junction table for mapping expense categories to vendor trade tags.
/// Enables future AI-assisted vendor recommendations based on expense category.
/// </summary>
public class CategoryTradeTagMapping
{
    public Guid CategoryId { get; set; }
    public Guid TradeTagId { get; set; }

    // Navigation properties
    public ExpenseCategory Category { get; set; } = null!;
    public VendorTradeTag TradeTag { get; set; } = null!;
}
