using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Generated report entity for storing report metadata.
/// Reports are stored in S3, metadata in database.
/// </summary>
public class GeneratedReport : ITenantEntity, ISoftDeletable
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid? PropertyId { get; set; }  // null for batch reports
    public string? PropertyName { get; set; }  // Cached for display
    public int Year { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public ReportType ReportType { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;
    public Property? Property { get; set; }
}

public enum ReportType
{
    SingleProperty,
    Batch
}
