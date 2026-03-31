using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Vendor photo entity for storing vendor images.
/// Supports display ordering and primary photo designation.
/// </summary>
public class VendorPhoto : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public Guid VendorId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string? ThumbnailStorageKey { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsPrimary { get; set; }
    public Guid CreatedByUserId { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;
    public Vendor Vendor { get; set; } = null!;
}
