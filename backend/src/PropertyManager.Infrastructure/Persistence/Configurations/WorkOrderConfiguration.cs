using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for WorkOrder entity.
/// Configures relationships, indexes, and soft delete support.
/// </summary>
public class WorkOrderConfiguration : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> builder)
    {
        builder.ToTable("WorkOrders");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.PropertyId)
            .IsRequired();

        builder.Property(e => e.CreatedByUserId)
            .IsRequired();

        // Status stored as string (VARCHAR) per Architecture ADR #19
        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(50)
            .HasDefaultValue(WorkOrderStatus.Reported)
            .IsRequired();

        builder.Property(e => e.Description)
            .IsRequired();

        builder.Property(e => e.DeletedAt);

        // Ignore computed property
        builder.Ignore(e => e.IsDiy);

        // FK to Account
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to Property - Restrict delete (don't cascade delete work orders)
        builder.HasOne(e => e.Property)
            .WithMany(p => p.WorkOrders)
            .HasForeignKey(e => e.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        // FK to Vendor - SetNull if vendor deleted (work order becomes DIY)
        builder.HasOne(e => e.Vendor)
            .WithMany(v => v.WorkOrders)
            .HasForeignKey(e => e.VendorId)
            .OnDelete(DeleteBehavior.SetNull);

        // FK to ExpenseCategory - SetNull if category deleted
        builder.HasOne(e => e.Category)
            .WithMany(c => c.WorkOrders)
            .HasForeignKey(e => e.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        // FK to CreatedByUser (ApplicationUser) - Restrict delete
        // Note: Relationship configured via shadow FK - no navigation property
        // due to Clean Architecture constraints (Domain can't reference Infrastructure)
        builder.HasIndex(e => e.CreatedByUserId)
            .HasDatabaseName("IX_WorkOrders_CreatedByUserId");

        // Index for filtered queries by account and status
        builder.HasIndex(e => new { e.AccountId, e.Status })
            .HasDatabaseName("IX_WorkOrders_AccountId_Status");

        // Index for soft delete queries
        builder.HasIndex(e => e.DeletedAt)
            .HasDatabaseName("IX_WorkOrders_DeletedAt");

        // Note: Global query filter for tenant isolation and soft delete
        // is applied in AppDbContext.OnModelCreating
    }
}
