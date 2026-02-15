using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests.Middleware;

public class RateLimitingTests
{
    private static WebApplicationFactory<Program> CreateFactory()
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Remove Npgsql-based DbContext registration
                var dbOptionsDescriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
                if (dbOptionsDescriptor != null) services.Remove(dbOptionsDescriptor);

                var appDbContextDescriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(IAppDbContext));
                if (appDbContextDescriptor != null) services.Remove(appDbContextDescriptor);

                // Use InMemoryDatabase — rate limiting tests don't exercise database logic
                services.AddDbContext<AppDbContext>(options =>
                    options.UseInMemoryDatabase($"RateLimitTest_{Guid.NewGuid()}"));
                services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

                // Replace email service to avoid SMTP connection attempts
                var emailDescriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(IEmailService));
                if (emailDescriptor != null) services.Remove(emailDescriptor);
                services.AddSingleton<IEmailService, FakeEmailService>();
            });

            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Cors:AllowedOrigins:0"] = "http://localhost:4200"
                });
            });

            builder.UseEnvironment("Development");
        });
    }

    [Fact]
    public async Task AuthEndpoint_Returns429_After5RequestsPerMinute()
    {
        // Arrange
        await using var factory = CreateFactory();
        var client = factory.CreateClient();
        var loginRequest = new { Email = "test@test.com", Password = "password" };

        // Act — send 5 requests (all should pass through rate limiter)
        for (var i = 0; i < 5; i++)
        {
            var response = await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                $"Request {i + 1} of 5 should not be rate limited");
        }

        // Act — 6th request should be rate limited
        var rateLimitedResponse = await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        rateLimitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task AuthEndpoint_429Response_IncludesRetryAfterHeader()
    {
        // Arrange
        await using var factory = CreateFactory();
        var client = factory.CreateClient();
        var loginRequest = new { Email = "test@test.com", Password = "password" };

        // Exhaust the auth rate limit
        for (var i = 0; i < 5; i++)
            await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Act
        var rateLimitedResponse = await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        rateLimitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        rateLimitedResponse.Headers.Contains("Retry-After").Should().BeTrue();
        var retryAfterValue = rateLimitedResponse.Headers.GetValues("Retry-After").First();
        int.TryParse(retryAfterValue, out var retrySeconds).Should().BeTrue();
        retrySeconds.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task AuthEndpoint_429Response_IsProblemDetailsWithStatus429()
    {
        // Arrange
        await using var factory = CreateFactory();
        var client = factory.CreateClient();
        var loginRequest = new { Email = "test@test.com", Password = "password" };

        // Exhaust the auth rate limit
        for (var i = 0; i < 5; i++)
            await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Act
        var rateLimitedResponse = await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        rateLimitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        var body = await rateLimitedResponse.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("status").GetInt32().Should().Be(429);
        body.GetProperty("title").GetString().Should().Be("Too many requests");
        body.GetProperty("type").GetString().Should().Be("https://propertymanager.app/errors/rate-limit-exceeded");
        body.GetProperty("detail").GetString().Should().Contain("Rate limit exceeded");
    }

    [Fact]
    public async Task RefreshEndpoint_Returns429_After10RequestsPerMinute()
    {
        // Arrange
        await using var factory = CreateFactory();
        var client = factory.CreateClient();

        // Act — send 10 requests (all should pass through rate limiter)
        for (var i = 0; i < 10; i++)
        {
            var response = await client.PostAsync("/api/v1/auth/refresh", null);
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                $"Request {i + 1} of 10 should not be rate limited");
        }

        // Act — 11th request should be rate limited
        var rateLimitedResponse = await client.PostAsync("/api/v1/auth/refresh", null);

        // Assert
        rateLimitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        rateLimitedResponse.Headers.Contains("Retry-After").Should().BeTrue();
    }

    [Fact]
    public async Task GeneralApiEndpoint_Returns429_After100RequestsPerMinute()
    {
        // Arrange — Logout is public (no [Authorize]) and has no endpoint-specific
        // rate limit, so only the global "api" limiter (100/min) applies
        await using var factory = CreateFactory();
        var client = factory.CreateClient();

        // Act — send 100 requests (all should pass through global rate limiter)
        for (var i = 0; i < 100; i++)
        {
            var response = await client.PostAsync("/api/v1/auth/logout", null);
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                $"Request {i + 1} of 100 should not be rate limited");
        }

        // Act — 101st request should be rate limited by global limiter
        var rateLimitedResponse = await client.PostAsync("/api/v1/auth/logout", null);

        // Assert
        rateLimitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task RequestsUnderLimit_AreNotRateLimited()
    {
        // Arrange
        await using var factory = CreateFactory();
        var client = factory.CreateClient();
        var loginRequest = new { Email = "test@test.com", Password = "password" };

        // Act — send fewer requests than the limit
        for (var i = 0; i < 3; i++)
        {
            var response = await client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

            // Assert — should pass through rate limiter (may return 400/401 from controller)
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                $"Request {i + 1} of 3 should not be rate limited");
        }
    }
}
