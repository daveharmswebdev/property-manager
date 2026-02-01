using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Work order photo entity for storing images related to work orders.
/// Supports display ordering and primary photo designation (symmetric with PropertyPhoto).
/// </summary>
public class WorkOrderPhoto : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public Guid WorkOrderId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string? ThumbnailStorageKey { get; set; }
    public string? OriginalFileName { get; set; }
    public string? ContentType { get; set; }
    public long? FileSizeBytes { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsPrimary { get; set; }
    public Guid CreatedByUserId { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;
    public WorkOrder WorkOrder { get; set; } = null!;
}
