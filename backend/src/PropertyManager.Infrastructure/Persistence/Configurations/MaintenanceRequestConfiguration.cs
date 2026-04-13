using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for MaintenanceRequest entity.
/// Configures relationships, indexes, status conversion, and soft delete support.
/// </summary>
public class MaintenanceRequestConfiguration : IEntityTypeConfiguration<MaintenanceRequest>
{
    public void Configure(EntityTypeBuilder<MaintenanceRequest> builder)
    {
        builder.ToTable("MaintenanceRequests");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.PropertyId)
            .IsRequired();

        builder.Property(e => e.SubmittedByUserId)
            .IsRequired();

        // Status stored as string (VARCHAR) per Architecture ADR #19
        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(50)
            .HasDefaultValue(MaintenanceRequestStatus.Submitted)
            .IsRequired();

        // Allow long descriptions — no max length constraint
        builder.Property(e => e.Description)
            .IsRequired();

        builder.Property(e => e.DismissalReason)
            .HasMaxLength(2000);

        builder.Property(e => e.DeletedAt);

        // FK to Account with cascade delete
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to Property with restrict delete (don't cascade delete requests)
        builder.HasOne(e => e.Property)
            .WithMany(p => p.MaintenanceRequests)
            .HasForeignKey(e => e.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        // FK to WorkOrder (optional) with SetNull if work order deleted
        builder.HasOne(e => e.WorkOrder)
            .WithMany()
            .HasForeignKey(e => e.WorkOrderId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(e => new { e.AccountId, e.Status })
            .HasDatabaseName("IX_MaintenanceRequests_AccountId_Status");

        builder.HasIndex(e => e.PropertyId)
            .HasDatabaseName("IX_MaintenanceRequests_PropertyId");

        builder.HasIndex(e => e.SubmittedByUserId)
            .HasDatabaseName("IX_MaintenanceRequests_SubmittedByUserId");

        builder.HasIndex(e => e.DeletedAt)
            .HasDatabaseName("IX_MaintenanceRequests_DeletedAt");

        // Note: Global query filter for tenant isolation and soft delete
        // is applied in AppDbContext.OnModelCreating
    }
}
