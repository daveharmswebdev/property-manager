using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

public class VendorPhotoConfiguration : IEntityTypeConfiguration<VendorPhoto>
{
    public void Configure(EntityTypeBuilder<VendorPhoto> builder)
    {
        builder.ToTable("VendorPhotos");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.VendorId)
            .IsRequired();

        builder.Property(e => e.StorageKey)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.ThumbnailStorageKey)
            .HasMaxLength(500);

        builder.Property(e => e.OriginalFileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.ContentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.FileSizeBytes)
            .IsRequired();

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
            .HasDatabaseName("IX_VendorPhotos_AccountId");

        // Index on (VendorId, DisplayOrder) for efficient ordering
        builder.HasIndex(e => new { e.VendorId, e.DisplayOrder })
            .HasDatabaseName("IX_VendorPhotos_VendorId_DisplayOrder");

        // Unique filtered index: only one primary photo per vendor
        builder.HasIndex(e => new { e.VendorId, e.IsPrimary })
            .HasDatabaseName("IX_VendorPhotos_VendorId_IsPrimary_Unique")
            .IsUnique()
            .HasFilter("\"IsPrimary\" = true");

        // Relationship to Account
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // Relationship to Vendor with cascade delete
        builder.HasOne(e => e.Vendor)
            .WithMany(v => v.VendorPhotos)
            .HasForeignKey(e => e.VendorId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index on CreatedByUserId for audit/reporting queries
        builder.HasIndex(e => e.CreatedByUserId)
            .HasDatabaseName("IX_VendorPhotos_CreatedByUserId");
    }
}
