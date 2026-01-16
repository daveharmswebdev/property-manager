using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for CategoryTradeTagMapping junction table.
/// Maps expense categories to vendor trade tags.
/// </summary>
public class CategoryTradeTagMappingConfiguration : IEntityTypeConfiguration<CategoryTradeTagMapping>
{
    public void Configure(EntityTypeBuilder<CategoryTradeTagMapping> builder)
    {
        builder.ToTable("CategoryTradeTagMappings");

        // Composite primary key
        builder.HasKey(e => new { e.CategoryId, e.TradeTagId });

        // FK to ExpenseCategory
        builder.HasOne(e => e.Category)
            .WithMany(c => c.TradeTagMappings)
            .HasForeignKey(e => e.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to VendorTradeTag
        builder.HasOne(e => e.TradeTag)
            .WithMany(t => t.CategoryMappings)
            .HasForeignKey(e => e.TradeTagId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
