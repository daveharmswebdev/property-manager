using PropertyManager.Domain.Common;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Maintenance request entity submitted by tenants and managed by landlords.
/// Implements tenant isolation, soft delete, and audit tracking.
/// </summary>
public class MaintenanceRequest : AuditableEntity, ITenantEntity, ISoftDeletable
{
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }

    // Note: SubmittedByUserId references ApplicationUser (Identity) - no navigation property due to Clean Architecture constraints
    public Guid SubmittedByUserId { get; set; }
    public Guid? WorkOrderId { get; set; }
    public string Description { get; set; } = string.Empty;
    public MaintenanceRequestStatus Status { get; set; } = MaintenanceRequestStatus.Submitted;
    public string? DismissalReason { get; set; }
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;
    public Property Property { get; set; } = null!;
    public WorkOrder? WorkOrder { get; set; }
    public ICollection<MaintenanceRequestPhoto> Photos { get; set; } = new List<MaintenanceRequestPhoto>();

    /// <summary>
    /// Transitions the maintenance request to a new status.
    /// Only valid transitions are allowed:
    ///   Submitted -> InProgress
    ///   Submitted -> Dismissed
    ///   InProgress -> Resolved
    /// </summary>
    /// <param name="newStatus">The target status.</param>
    /// <exception cref="BusinessRuleException">Thrown when the transition is not allowed.</exception>
    public void TransitionTo(MaintenanceRequestStatus newStatus)
    {
        var isValid = (Status, newStatus) switch
        {
            (MaintenanceRequestStatus.Submitted, MaintenanceRequestStatus.InProgress) => true,
            (MaintenanceRequestStatus.Submitted, MaintenanceRequestStatus.Dismissed) => true,
            (MaintenanceRequestStatus.InProgress, MaintenanceRequestStatus.Resolved) => true,
            _ => false
        };

        if (!isValid)
        {
            throw new BusinessRuleException(
                $"Cannot transition maintenance request from '{Status}' to '{newStatus}'.");
        }

        Status = newStatus;
    }
}
