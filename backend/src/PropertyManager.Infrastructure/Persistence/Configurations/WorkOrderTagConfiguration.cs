using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for WorkOrderTag entity.
/// Configures table, unique constraint, and tenant isolation.
/// </summary>
public class WorkOrderTagConfiguration : IEntityTypeConfiguration<WorkOrderTag>
{
    public void Configure(EntityTypeBuilder<WorkOrderTag> builder)
    {
        builder.ToTable("WorkOrderTags");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        // Unique constraint: no duplicate tag names within the same account
        builder.HasIndex(e => new { e.AccountId, e.Name })
            .IsUnique()
            .HasDatabaseName("IX_WorkOrderTags_AccountId_Name");

        // FK to Account
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // Note: Global query filter for tenant isolation is applied in AppDbContext
    }
}
