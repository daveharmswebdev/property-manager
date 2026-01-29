using PropertyManager.Domain.Common;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Polymorphic Note entity that can be attached to any entity type (WorkOrder, Vendor, Property).
/// Uses EntityType + EntityId discriminator pattern (per Architecture ADR-16).
/// </summary>
public class Note : AuditableEntity, ITenantEntity, ISoftDeletable
{
    public Guid AccountId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public Account Account { get; set; } = null!;
    // Note: CreatedByUserId references ApplicationUser (Identity) - navigation configured in Infrastructure
}
