using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Identity;
using PropertyManager.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

// UploadUrlResult is in Application.Common.Interfaces

namespace PropertyManager.Api.Tests;

public class PropertyManagerWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove existing DbContext registration
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));

            if (descriptor != null)
            {
                services.Remove(descriptor);
            }

            // Remove the IAppDbContext registration too
            var appDbContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IAppDbContext));

            if (appDbContextDescriptor != null)
            {
                services.Remove(appDbContextDescriptor);
            }

            // Add test database
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseNpgsql(_postgres.GetConnectionString());
            });

            services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

            // Replace email service with a singleton fake for testing
            var emailServiceDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IEmailService));

            if (emailServiceDescriptor != null)
            {
                services.Remove(emailServiceDescriptor);
            }

            services.AddSingleton<FakeEmailService>();
            services.AddSingleton<IEmailService>(sp => sp.GetRequiredService<FakeEmailService>());

            // Replace storage service with a singleton fake for testing
            var storageServiceDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IStorageService));

            if (storageServiceDescriptor != null)
            {
                services.Remove(storageServiceDescriptor);
            }

            services.AddSingleton<FakeStorageService>();
            services.AddSingleton<IStorageService>(sp => sp.GetRequiredService<FakeStorageService>());
        });

        builder.UseEnvironment("Testing");
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Apply migrations
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.StopAsync();
        await base.DisposeAsync();
    }

    /// <summary>
    /// Creates a test user with a verified email directly in the database.
    /// This bypasses the registration endpoint for test setup.
    /// </summary>
    public async Task<(Guid UserId, Guid AccountId)> CreateTestUserAsync(string email, string password = "Test@123456", string role = "Owner")
    {
        using var scope = Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Create an Account first
        var account = new Account
        {
            Id = Guid.NewGuid(),
            Name = $"Test Account for {email}",
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Accounts.Add(account);
        await dbContext.SaveChangesAsync();

        // Create the ApplicationUser with confirmed email
        var user = new ApplicationUser
        {
            Email = email,
            UserName = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            EmailConfirmed = true, // Skip email verification for tests
            AccountId = account.Id,
            Role = role
        };

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            throw new InvalidOperationException($"Failed to create test user: {string.Join(", ", createResult.Errors.Select(e => e.Description))}");
        }

        return (user.Id, account.Id);
    }
}

public class FakeEmailService : IEmailService
{
    public List<(string Email, string Token)> SentVerificationEmails { get; } = [];
    public List<(string Email, string Token)> SentPasswordResetEmails { get; } = [];
    public List<(string Email, string Code)> SentInvitationEmails { get; } = [];

    public Task SendVerificationEmailAsync(string email, string token, CancellationToken cancellationToken = default)
    {
        SentVerificationEmails.Add((email, token));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string email, string token, CancellationToken cancellationToken = default)
    {
        SentPasswordResetEmails.Add((email, token));
        return Task.CompletedTask;
    }

    public Task SendInvitationEmailAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        SentInvitationEmails.Add((email, code));
        return Task.CompletedTask;
    }
}

public class FakeStorageService : IStorageService
{
    public List<string> UploadedKeys { get; } = [];
    public List<string> DeletedKeys { get; } = [];

    public Task<UploadUrlResult> GeneratePresignedUploadUrlAsync(
        string storageKey,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default)
    {
        UploadedKeys.Add(storageKey);
        var expiresAt = DateTime.UtcNow.AddMinutes(60);
        var url = $"https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=true";
        return Task.FromResult(new UploadUrlResult(url, expiresAt));
    }

    public Task<string> GeneratePresignedDownloadUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult($"https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=download");
    }

    public Task DeleteFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        DeletedKeys.Add(storageKey);
        return Task.CompletedTask;
    }
}
