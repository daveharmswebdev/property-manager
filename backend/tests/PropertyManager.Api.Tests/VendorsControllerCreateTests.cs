using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for VendorsController POST endpoint (AC #7, #8).
/// </summary>
public class VendorsControllerCreateTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public VendorsControllerCreateTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/vendors Tests (AC #7)
    // =====================================================

    [Fact]
    public async Task CreateVendor_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new { FirstName = "Joe", LastName = "Smith" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/vendors", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateVendor_ValidRequest_Returns201WithId()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { FirstName = "Joe", MiddleName = "Allen", LastName = "Smith" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateVendorResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateVendor_ValidRequest_ReturnsLocationHeader()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { FirstName = "Jane", LastName = "Doe" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.ToString().Should().Contain("/api/v1/vendors/");
    }

    [Fact]
    public async Task CreateVendor_ValidRequest_CreatesInDatabase()
    {
        // Arrange
        var email = $"create-vendor-db-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var request = new { FirstName = "Database", MiddleName = "Test", LastName = "Vendor" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateVendorResponse>();

        // Assert - verify in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var vendor = await dbContext.Vendors.FirstOrDefaultAsync(v => v.Id == content!.Id);
        vendor.Should().NotBeNull();
        vendor!.FirstName.Should().Be("Database");
        vendor.MiddleName.Should().Be("Test");
        vendor.LastName.Should().Be("Vendor");
        vendor.Phones.Should().BeEmpty();
        vendor.Emails.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateVendor_ValidRequest_SetsAccountIdFromJwt()
    {
        // Arrange
        var email = $"vendor-account-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var request = new { FirstName = "Account", LastName = "Test" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateVendorResponse>();

        // Assert - verify AccountId was set
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var vendor = await dbContext.Vendors.FirstOrDefaultAsync(v => v.Id == content!.Id);
        vendor.Should().NotBeNull();
        vendor!.AccountId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateVendor_NullMiddleName_Accepted()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { FirstName = "No", LastName = "Middle" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateVendor_AppearsInGetAll()
    {
        // Arrange
        var email = $"vendor-getall-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var request = new { FirstName = "GetAll", LastName = "Test" };

        // Create vendor
        await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Act
        var getResponse = await GetWithAuthAsync("/api/v1/vendors", accessToken);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await getResponse.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().Contain(v => v.FirstName == "GetAll" && v.LastName == "Test");
    }

    // =====================================================
    // Validation Tests (AC #8)
    // =====================================================

    [Fact]
    public async Task CreateVendor_MissingFirstName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { LastName = "Smith" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendor_EmptyFirstName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { FirstName = "", LastName = "Smith" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendor_MissingLastName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { FirstName = "Joe" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendor_EmptyLastName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { FirstName = "Joe", LastName = "" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendor_NullBody_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/vendors");
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = new StringContent("null", System.Text.Encoding.UTF8, "application/json");
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        return accessToken;
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginAsync(string email)
    {
        var password = "Test@123456";

        // Create user directly in database (bypasses removed registration endpoint)
        var (userId, _) = await _factory.CreateTestUserAsync(email, password);

        // Login
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, userId);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> GetWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }
}

// Response records for deserialization
public record CreateVendorResponse(Guid Id);
public record PhoneNumberDto(string Number, string? Label);
public record VendorTradeTagDto(Guid Id, string Name);
public record VendorDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    IReadOnlyList<PhoneNumberDto> Phones,
    IReadOnlyList<string> Emails,
    IReadOnlyList<VendorTradeTagDto> TradeTags
);
public record GetAllVendorsResponse(IReadOnlyList<VendorDto> Items, int TotalCount);
