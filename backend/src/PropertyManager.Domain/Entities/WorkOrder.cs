using PropertyManager.Domain.Common;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Work order entity for tracking maintenance and repair work.
/// Implements tenant isolation, soft delete, and audit tracking.
/// VendorId NULL means DIY (self-assigned) per Architecture ADR #21.
/// </summary>
public class WorkOrder : AuditableEntity, ITenantEntity, ISoftDeletable
{
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public Guid? VendorId { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Reported;
    public string Description { get; set; } = string.Empty;
    public DateTime? DeletedAt { get; set; }

    /// <summary>
    /// Indicates if this work order is assigned to self (DIY).
    /// True when VendorId is null.
    /// </summary>
    public bool IsDiy => VendorId == null;

    // Navigation properties
    public Account Account { get; set; } = null!;
    public Property Property { get; set; } = null!;
    public Vendor? Vendor { get; set; }
    public ExpenseCategory? Category { get; set; }
    // Note: CreatedByUser navigation not included - ApplicationUser is in Infrastructure layer

    // Navigation to tag assignments (junction table)
    public ICollection<WorkOrderTagAssignment> TagAssignments { get; set; } = new List<WorkOrderTagAssignment>();
}
