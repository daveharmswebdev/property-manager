using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for PropertiesController (AC-2.1.1, AC-2.1.3, AC-2.1.4, AC-2.1.5).
/// </summary>
public class PropertiesControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public PropertiesControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateProperty_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            Name = "Oak Street Duplex",
            Street = "123 Oak Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/properties", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateProperty_WithValidData_Returns201WithId()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            Name = "Oak Street Duplex",
            Street = "123 Oak Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken!);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreatePropertyResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBe(Guid.Empty);

        // Verify Location header is present
        response.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateProperty_WithMissingName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            Name = "",
            Street = "123 Oak Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Name");
    }

    [Fact]
    public async Task CreateProperty_WithInvalidState_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            Name = "Oak Street Duplex",
            Street = "123 Oak Street",
            City = "Austin",
            State = "Texas", // Should be 2 characters
            ZipCode = "78701"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("State");
    }

    [Fact]
    public async Task CreateProperty_WithInvalidZipCode_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            Name = "Oak Street Duplex",
            Street = "123 Oak Street",
            City = "Austin",
            State = "TX",
            ZipCode = "ABCDE" // Should be 5 digits
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("ZipCode");
    }

    [Fact]
    public async Task CreateProperty_CreatesWithCorrectAccountId()
    {
        // Arrange
        var email = $"property-test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var request = new
        {
            Name = "Multi-Tenant Test Property",
            Street = "789 Test Street",
            City = "Dallas",
            State = "TX",
            ZipCode = "75201"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Verify the property was created with the correct account
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var property = await dbContext.Properties
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == content!.Id);

        property.Should().NotBeNull();
        property!.Name.Should().Be("Multi-Tenant Test Property");
        property.Street.Should().Be("789 Test Street");
        property.City.Should().Be("Dallas");
        property.State.Should().Be("TX");
        property.ZipCode.Should().Be("75201");
        property.AccountId.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task CreateProperty_SetsTimestamps()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            Name = "Timestamp Test Property",
            Street = "101 Time Street",
            City = "Houston",
            State = "TX",
            ZipCode = "77001"
        };

        var beforeCreate = DateTime.UtcNow;

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        var afterCreate = DateTime.UtcNow;

        // Assert
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var property = await dbContext.Properties
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == content!.Id);

        property.Should().NotBeNull();
        property!.CreatedAt.Should().BeAfter(beforeCreate.AddSeconds(-1));
        property.CreatedAt.Should().BeBefore(afterCreate.AddSeconds(1));
        property.UpdatedAt.Should().BeAfter(beforeCreate.AddSeconds(-1));
        property.UpdatedAt.Should().BeBefore(afterCreate.AddSeconds(1));
    }

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        return accessToken;
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginAsync(string email)
    {
        var password = "Test@123456";

        // Register
        var registerRequest = new
        {
            Email = email,
            Password = password,
            Name = "Test Account"
        };
        var registerResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        registerResponse.EnsureSuccessStatusCode();

        // Verify email using fake email service
        using var scope = _factory.Services.CreateScope();
        var fakeEmailService = scope.ServiceProvider.GetRequiredService<FakeEmailService>();
        var verificationToken = fakeEmailService.SentVerificationEmails.Last().Token;

        var verifyRequest = new { Token = verificationToken };
        var verifyResponse = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", verifyRequest);
        verifyResponse.EnsureSuccessStatusCode();

        // Login
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, Guid.Empty);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }
}

public record CreatePropertyResponse(Guid Id);
public record LoginResponse(string AccessToken, int ExpiresIn);
