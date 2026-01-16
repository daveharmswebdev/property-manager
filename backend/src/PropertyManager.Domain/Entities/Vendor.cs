using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Vendor entity extending Person with soft delete support.
/// Implements TPT inheritance - stored in Vendors table with FK to Persons.Id.
/// </summary>
public class Vendor : Person, ISoftDeletable
{
    public DateTime? DeletedAt { get; set; }

    // Navigation to TradeTags collection (placeholder for future story 8-2)
    // public ICollection<TradeTag> TradeTags { get; set; } = new List<TradeTag>();
}
