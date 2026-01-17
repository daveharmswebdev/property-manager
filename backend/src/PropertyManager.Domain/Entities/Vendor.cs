using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Vendor entity extending Person with soft delete support.
/// Implements TPT inheritance - stored in Vendors table with FK to Persons.Id.
/// </summary>
public class Vendor : Person, ISoftDeletable
{
    public DateTime? DeletedAt { get; set; }

    // Navigation to trade tag assignments (junction table)
    public ICollection<VendorTradeTagAssignment> TradeTagAssignments { get; set; } = new List<VendorTradeTagAssignment>();
}
