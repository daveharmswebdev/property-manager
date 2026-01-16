using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for Vendor entity.
/// Implements TPT inheritance - Vendors table with FK to Persons.Id.
/// </summary>
public class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> builder)
    {
        // TPT inheritance - Vendor extends Person
        // Id is FK to Persons.Id (TPT pattern)
        builder.ToTable("Vendors");

        // Soft delete column
        builder.Property(e => e.DeletedAt);

        // Index for soft delete queries (WHERE DeletedAt IS NULL)
        builder.HasIndex(e => e.DeletedAt)
            .HasDatabaseName("IX_Vendors_DeletedAt");
    }
}
