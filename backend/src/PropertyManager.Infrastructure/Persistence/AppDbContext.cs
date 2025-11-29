using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Common;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Infrastructure.Persistence;

/// <summary>
/// Main EF Core DbContext with global query filters for soft delete and tenant isolation.
/// </summary>
public class AppDbContext : DbContext
{
    private readonly ICurrentUser? _currentUser;

    // Properties for EF Core query filter parameterization
    private Guid? CurrentAccountId => _currentUser?.IsAuthenticated == true ? _currentUser.AccountId : null;

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : base(options)
    {
        _currentUser = currentUser;
    }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Income> Income => Set<Income>();
    public DbSet<Receipt> Receipts => Set<Receipt>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations from the assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Configure global query filters for tenant isolation (ITenantEntity)
        ConfigureTenantFilters(modelBuilder);

        // Configure global query filters for soft delete (ISoftDeletable)
        ConfigureSoftDeleteFilters(modelBuilder);
    }

    private void ConfigureTenantFilters(ModelBuilder modelBuilder)
    {
        // Apply tenant filter to User
        // When CurrentAccountId is null (no user or unauthenticated), no filter is applied
        modelBuilder.Entity<User>()
            .HasQueryFilter(e => CurrentAccountId == null || e.AccountId == CurrentAccountId);

        // Apply tenant filter to Property (combined with soft delete)
        modelBuilder.Entity<Property>()
            .HasQueryFilter(e => (CurrentAccountId == null || e.AccountId == CurrentAccountId)
                                 && e.DeletedAt == null);

        // Apply tenant filter to Expense (combined with soft delete)
        modelBuilder.Entity<Expense>()
            .HasQueryFilter(e => (CurrentAccountId == null || e.AccountId == CurrentAccountId)
                                 && e.DeletedAt == null);

        // Apply tenant filter to Income (combined with soft delete)
        modelBuilder.Entity<Income>()
            .HasQueryFilter(e => (CurrentAccountId == null || e.AccountId == CurrentAccountId)
                                 && e.DeletedAt == null);

        // Apply tenant filter to Receipt (combined with soft delete)
        modelBuilder.Entity<Receipt>()
            .HasQueryFilter(e => (CurrentAccountId == null || e.AccountId == CurrentAccountId)
                                 && e.DeletedAt == null);
    }

    private void ConfigureSoftDeleteFilters(ModelBuilder modelBuilder)
    {
        // Note: Soft delete filters are combined with tenant filters above
        // This method is kept for documentation purposes
        // Entities with ISoftDeletable: Property, Expense, Income, Receipt
    }

    public override int SaveChanges()
    {
        UpdateAuditFields();
        return base.SaveChanges();
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        UpdateAuditFields();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        UpdateAuditFields();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void UpdateAuditFields()
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = utcNow;
                    entry.Entity.UpdatedAt = utcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = utcNow;
                    break;
            }
        }

        // Handle Account entity (not AuditableEntity but has CreatedAt)
        foreach (var entry in ChangeTracker.Entries<Account>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = utcNow;
            }
        }
    }
}
