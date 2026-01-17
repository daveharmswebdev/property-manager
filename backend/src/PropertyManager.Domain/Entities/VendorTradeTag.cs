using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Vendor trade tag entity for categorizing vendors by specialty.
/// Flat taxonomy (no hierarchy) - each account maintains their own tags.
/// </summary>
public class VendorTradeTag : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Navigation to Account
    public Account Account { get; set; } = null!;

    // Navigation to vendor assignments (junction table)
    public ICollection<VendorTradeTagAssignment> VendorAssignments { get; set; } = new List<VendorTradeTagAssignment>();

    // Navigation to CategoryTradeTagMappings
    public ICollection<CategoryTradeTagMapping> CategoryMappings { get; set; } = new List<CategoryTradeTagMapping>();
}
