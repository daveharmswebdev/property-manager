using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

public class GeneratedReportConfiguration : IEntityTypeConfiguration<GeneratedReport>
{
    public void Configure(EntityTypeBuilder<GeneratedReport> builder)
    {
        builder.ToTable("GeneratedReports");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.AccountId)
            .IsRequired();

        builder.Property(e => e.PropertyId);

        builder.Property(e => e.PropertyName)
            .HasMaxLength(255);

        builder.Property(e => e.Year)
            .IsRequired();

        builder.Property(e => e.FileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.StorageKey)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.FileSizeBytes)
            .IsRequired();

        builder.Property(e => e.ReportType)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        builder.Property(e => e.DeletedAt);

        // Indexes
        builder.HasIndex(e => e.AccountId)
            .HasDatabaseName("IX_GeneratedReports_AccountId");

        builder.HasIndex(e => new { e.AccountId, e.CreatedAt })
            .HasDatabaseName("IX_GeneratedReports_AccountId_CreatedAt")
            .IsDescending(false, true);

        // Relationships
        builder.HasOne(e => e.Account)
            .WithMany()
            .HasForeignKey(e => e.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Property)
            .WithMany()
            .HasForeignKey(e => e.PropertyId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
