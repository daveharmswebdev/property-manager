using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for MaintenanceRequestPhoto entity.
/// Supports display ordering and primary photo designation (symmetric with WorkOrderPhoto).
/// </summary>
public class MaintenanceRequestPhotoConfiguration : IEntityTypeConfiguration<MaintenanceRequestPhoto>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequestPhoto> builder)
    {
        builder.ToTable("MaintenanceRequestPhotos");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.MaintenanceRequestId)
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

        builder.Property(e => e.DisplayOrder)
            .IsRequired();

        builder.Property(e => e.IsPrimary)
            .IsRequired();

        builder.Property(e => e.CreatedByUserId)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .IsRequired();

        // Index on AccountId for tenant isolation queries
        builder.HasIndex(e => e.AccountId)
            .HasDatabaseName("IX_MaintenanceRequestPhotos_AccountId");

        // Index on (MaintenanceRequestId, DisplayOrder) for efficient ordering
        builder.HasIndex(e => new { e.MaintenanceRequestId, e.DisplayOrder })
            .HasDatabaseName("IX_MaintenanceRequestPhotos_MaintenanceRequestId_DisplayOrder");

        // Unique filtered index: only one primary photo per maintenance request
        builder.HasIndex(e => new { e.MaintenanceRequestId, e.IsPrimary })
            .HasDatabaseName("IX_MaintenanceRequestPhotos_MaintenanceRequestId_IsPrimary_Unique")
            .IsUnique()
            .HasFilter("\"IsPrimary\" = true");

        // Index on CreatedByUserId for audit/reporting queries
        builder.HasIndex(e => e.CreatedByUserId)
            .HasDatabaseName("IX_MaintenanceRequestPhotos_CreatedByUserId");

        // Relationship to Account
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Restrict);

        // Relationship to MaintenanceRequest with cascade delete
        builder.HasOne(e => e.MaintenanceRequest)
            .WithMany(mr => mr.Photos)
            .HasForeignKey(e => e.MaintenanceRequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
