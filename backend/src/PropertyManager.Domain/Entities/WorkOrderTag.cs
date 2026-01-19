using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Work order tag entity for categorizing work orders.
/// Each account maintains their own tags.
/// </summary>
public class WorkOrderTag : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Navigation to Account
    public Account Account { get; set; } = null!;

    // Navigation to work order assignments (junction table)
    public ICollection<WorkOrderTagAssignment> WorkOrderAssignments { get; set; } = new List<WorkOrderTagAssignment>();
}
