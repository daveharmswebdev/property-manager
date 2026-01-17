using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for VendorTradeTagAssignment junction table.
/// Maps vendors to trade tags for categorization.
/// </summary>
public class VendorTradeTagAssignmentConfiguration : IEntityTypeConfiguration<VendorTradeTagAssignment>
{
    public void Configure(EntityTypeBuilder<VendorTradeTagAssignment> builder)
    {
        builder.ToTable("VendorTradeTagAssignments");

        // Composite primary key
        builder.HasKey(e => new { e.VendorId, e.TradeTagId });

        // FK to Vendor
        builder.HasOne(e => e.Vendor)
            .WithMany(v => v.TradeTagAssignments)
            .HasForeignKey(e => e.VendorId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to VendorTradeTag
        builder.HasOne(e => e.TradeTag)
            .WithMany(t => t.VendorAssignments)
            .HasForeignKey(e => e.TradeTagId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
