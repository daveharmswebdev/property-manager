using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence.Configurations;

public class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("Invitations");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.CodeHash)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .IsRequired();

        builder.Property(e => e.ExpiresAt)
            .IsRequired();

        builder.Property(e => e.UsedAt)
            .IsRequired(false);

        // Index on Email for fast lookup of pending invitations
        builder.HasIndex(e => e.Email)
            .HasDatabaseName("IX_Invitations_Email");

        // Index on CodeHash for fast validation (unique since each code is hashed)
        builder.HasIndex(e => e.CodeHash)
            .IsUnique()
            .HasDatabaseName("IX_Invitations_CodeHash");
    }
}
