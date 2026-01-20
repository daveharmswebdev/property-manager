using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Property photo entity for storing property images.
/// Supports display ordering and primary photo designation.
/// </summary>
public class PropertyPhoto : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
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
    public Property Property { get; set; } = null!;
}
