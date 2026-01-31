using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for WorkOrderPhoto entity.
/// Simpler than PropertyPhoto - no primary photo or display order.
/// </summary>
public class WorkOrderPhotoConfiguration : IEntityTypeConfiguration<WorkOrderPhoto>
{
    public void Configure(EntityTypeBuilder<WorkOrderPhoto> builder)
    {
        builder.ToTable("WorkOrderPhotos");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.WorkOrderId)
            .IsRequired();

        builder.Property(e => e.StorageKey)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.ThumbnailStorageKey)
            .HasMaxLength(500);

        builder.Property(e => e.OriginalFileName)
            .HasMaxLength(255);

        builder.Property(e => e.ContentType)
            .HasMaxLength(100);

        builder.Property(e => e.CreatedByUserId)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .IsRequired();

        // Index on AccountId for tenant isolation queries
        builder.HasIndex(e => e.AccountId)
            .HasDatabaseName("IX_WorkOrderPhotos_AccountId");

        // Index on WorkOrderId for efficient lookups
        builder.HasIndex(e => e.WorkOrderId)
            .HasDatabaseName("IX_WorkOrderPhotos_WorkOrderId");

        // Index on CreatedByUserId for audit/reporting queries
        builder.HasIndex(e => e.CreatedByUserId)
            .HasDatabaseName("IX_WorkOrderPhotos_CreatedByUserId");

        // Relationship to Account
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

        // Relationship to WorkOrder with cascade delete
        builder.HasOne(e => e.WorkOrder)
            .WithMany(w => w.Photos)
            .HasForeignKey(e => e.WorkOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
