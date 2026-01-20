using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

public class PropertyPhotoConfiguration : IEntityTypeConfiguration<PropertyPhoto>
{
    public void Configure(EntityTypeBuilder<PropertyPhoto> builder)
    {
        builder.ToTable("PropertyPhotos");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.PropertyId)
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
            .HasDatabaseName("IX_PropertyPhotos_AccountId");

        // Index on (PropertyId, DisplayOrder) for efficient ordering
        builder.HasIndex(e => new { e.PropertyId, e.DisplayOrder })
            .HasDatabaseName("IX_PropertyPhotos_PropertyId_DisplayOrder");

        // Unique filtered index: only one primary photo per property
        builder.HasIndex(e => new { e.PropertyId, e.IsPrimary })
            .HasDatabaseName("IX_PropertyPhotos_PropertyId_IsPrimary_Unique")
            .IsUnique()
            .HasFilter("\"IsPrimary\" = true");

        // Relationship to Account
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // Relationship to Property with cascade delete
        builder.HasOne(e => e.Property)
            .WithMany(p => p.PropertyPhotos)
            .HasForeignKey(e => e.PropertyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
