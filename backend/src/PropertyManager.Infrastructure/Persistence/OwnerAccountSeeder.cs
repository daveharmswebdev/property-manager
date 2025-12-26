using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Identity;

namespace PropertyManager.Infrastructure.Persistence;

/// <summary>
/// Seeds the first owner account for the invitation-only registration system.
/// This seeder runs at application startup to ensure the owner account exists.
/// </summary>
public class OwnerAccountSeeder
{
    // Fixed ID for the owner account (enables idempotent seeding)
    private static readonly Guid OwnerAccountId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid OwnerUserId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    private const string OwnerEmail = "claude@claude.com";
    private const string OwnerPassword = "1@mClaude";
    private const string OwnerAccountName = "Owner Account";

    private readonly AppDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<OwnerAccountSeeder> _logger;

    public OwnerAccountSeeder(
        AppDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        ILogger<OwnerAccountSeeder> logger)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _logger = logger;
    }

    /// <summary>
    /// Seeds the owner account if it doesn't exist.
    /// Uses UserManager for proper password hashing.
    /// </summary>
    public async Task SeedAsync()
    {
        // Check if owner user already exists
        var existingUser = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == OwnerEmail.ToUpperInvariant());

        if (existingUser != null)
        {
            _logger.LogInformation("Owner account already exists, skipping seed");
            return;
        }

        _logger.LogInformation("Seeding owner account...");

        // Create the owner's Account (tenant boundary)
        var account = new Account
        {
            Id = OwnerAccountId,
            Name = OwnerAccountName,
            CreatedAt = DateTime.UtcNow
        };

        // Check if account exists (in case user was deleted but account remains)
        var existingAccount = await _dbContext.Accounts
            .FirstOrDefaultAsync(a => a.Id == OwnerAccountId);

        if (existingAccount == null)
        {
            _dbContext.Accounts.Add(account);
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Created owner account entity");
        }
        else
        {
            account = existingAccount;
        }

        // Create the owner user via UserManager (handles password hashing)
        var user = new ApplicationUser
        {
            Id = OwnerUserId,
            Email = OwnerEmail,
            UserName = OwnerEmail,
            NormalizedEmail = OwnerEmail.ToUpperInvariant(),
            NormalizedUserName = OwnerEmail.ToUpperInvariant(),
            AccountId = account.Id,
            Role = "Owner",
            EmailConfirmed = true, // Pre-confirmed since this is the seeded owner
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, OwnerPassword);

        if (result.Succeeded)
        {
            _logger.LogInformation("Owner account seeded successfully: {Email}", OwnerEmail);
        }
        else
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogError("Failed to seed owner account: {Errors}", errors);
            throw new InvalidOperationException($"Failed to seed owner account: {errors}");
        }
    }
}
