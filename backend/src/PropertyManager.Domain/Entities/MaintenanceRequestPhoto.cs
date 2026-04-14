using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Maintenance request photo entity for storing photos attached to maintenance requests.
/// Supports display ordering and primary photo designation.
/// </summary>
public class MaintenanceRequestPhoto : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public Guid MaintenanceRequestId { get; set; }
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
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
}
