using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for WorkOrderTagAssignment junction table.
/// Maps work orders to tags for categorization.
/// </summary>
public class WorkOrderTagAssignmentConfiguration : IEntityTypeConfiguration<WorkOrderTagAssignment>
{
    public void Configure(EntityTypeBuilder<WorkOrderTagAssignment> builder)
    {
        builder.ToTable("WorkOrderTagAssignments");

        // Composite primary key
        builder.HasKey(e => new { e.WorkOrderId, e.TagId });

        // FK to WorkOrder
        builder.HasOne(e => e.WorkOrder)
            .WithMany(w => w.TagAssignments)
            .HasForeignKey(e => e.WorkOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to WorkOrderTag
        builder.HasOne(e => e.Tag)
            .WithMany(t => t.WorkOrderAssignments)
            .HasForeignKey(e => e.TagId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
