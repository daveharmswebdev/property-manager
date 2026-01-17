namespace PropertyManager.Domain.Entities;

/// <summary>
/// Junction table for assigning trade tags to vendors.
/// Enables many-to-many relationship between Vendor and VendorTradeTag.
/// </summary>
public class VendorTradeTagAssignment
{
    public Guid VendorId { get; set; }
    public Guid TradeTagId { get; set; }

    // Navigation properties
    public Vendor Vendor { get; set; } = null!;
    public VendorTradeTag TradeTag { get; set; } = null!;
}
