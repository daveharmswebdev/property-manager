using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for the polymorphic Note entity.
/// Configures indexes for efficient lookups (AC #2) and tenant isolation.
/// </summary>
public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.ToTable("Notes");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.EntityType)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.EntityId)
            .IsRequired();

        builder.Property(e => e.Content)
            .IsRequired();

        builder.Property(e => e.CreatedByUserId)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .IsRequired();

        builder.Property(e => e.DeletedAt);

        // Relationships
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // Note: CreatedByUserId references ApplicationUser (Identity)
        // No navigation property - just the FK for data integrity
        builder.HasIndex(e => e.CreatedByUserId)
            .HasDatabaseName("IX_Notes_CreatedByUserId");

        // Index for efficient lookups by entity (AC #2)
        builder.HasIndex(e => new { e.EntityType, e.EntityId })
            .HasDatabaseName("IX_Notes_EntityType_EntityId");

        // Index for tenant filtering (AC #2)
        builder.HasIndex(e => e.AccountId)
            .HasDatabaseName("IX_Notes_AccountId");

        // Composite index for common query patterns (AC #2)
        builder.HasIndex(e => new { e.AccountId, e.EntityType, e.EntityId })
            .HasDatabaseName("IX_Notes_AccountId_EntityType_EntityId");
    }
}
