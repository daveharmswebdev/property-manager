namespace PropertyManager.Domain.Entities;

/// <summary>
/// Junction table for assigning tags to work orders.
/// Enables many-to-many relationship between WorkOrder and WorkOrderTag.
/// </summary>
public class WorkOrderTagAssignment
{
    public Guid WorkOrderId { get; set; }
    public Guid TagId { get; set; }

    // Navigation properties
    public WorkOrder WorkOrder { get; set; } = null!;
    public WorkOrderTag Tag { get; set; } = null!;
}
