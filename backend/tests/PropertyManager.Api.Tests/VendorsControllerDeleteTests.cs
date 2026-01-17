using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for VendorsController DELETE endpoint (AC #3, #5, #6).
/// </summary>
public class VendorsControllerDeleteTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public VendorsControllerDeleteTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // DELETE /api/v1/vendors/{id} Tests (AC #5, #6)
    // =====================================================

    [Fact]
    public async Task DeleteVendor_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/v1/vendors/{vendorId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteVendor_ValidRequest_Returns204()
    {
        // Arrange (AC #5)
        var email = $"delete-vendor-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var vendorId = await CreateVendorAsync(accessToken, "Delete", "Test");

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteVendor_ValidRequest_SetsDeletedAtInDatabase()
    {
        // Arrange (AC #3 - soft delete)
        var email = $"delete-vendor-db-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var vendorId = await CreateVendorAsync(accessToken, "SoftDelete", "Test");

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken);
        response.EnsureSuccessStatusCode();

        // Assert - verify in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var vendor = await dbContext.Vendors
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(v => v.Id == vendorId);
        vendor.Should().NotBeNull();
        vendor!.DeletedAt.Should().NotBeNull();
        vendor.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(10));
    }

    [Fact]
    public async Task DeleteVendor_NonExistentVendor_Returns404()
    {
        // Arrange (AC #6)
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteVendor_VendorBelongsToDifferentAccount_Returns404()
    {
        // Arrange (AC #6 - different account)
        var email1 = $"vendor-owner-{Guid.NewGuid():N}@example.com";
        var email2 = $"vendor-other-{Guid.NewGuid():N}@example.com";

        var (accessToken1, _) = await RegisterAndLoginAsync(email1);
        var (accessToken2, _) = await RegisterAndLoginAsync(email2);

        // Create vendor with first user
        var vendorId = await CreateVendorAsync(accessToken1, "OtherAccount", "Test");

        // Act - try to delete with second user
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteVendor_AlreadyDeleted_Returns404()
    {
        // Arrange - already deleted vendors should not be deletable again
        var email = $"delete-twice-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var vendorId = await CreateVendorAsync(accessToken, "DeleteTwice", "Test");

        // Delete first time
        var response1 = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken);
        response1.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Act - try to delete again
        var response2 = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken);

        // Assert
        response2.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteVendor_VendorNoLongerAppearsInGetAll()
    {
        // Arrange (AC #3 - vendor no longer appears in list)
        var email = $"delete-hidden-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var vendorId = await CreateVendorAsync(accessToken, "ToHide", "Vendor");

        // Verify vendor appears before deletion
        var getBefore = await GetWithAuthAsync("/api/v1/vendors", accessToken);
        var contentBefore = await getBefore.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        contentBefore!.Items.Should().Contain(v => v.Id == vendorId);

        // Act - delete the vendor
        await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", accessToken);

        // Assert - vendor should not appear in list
        var getAfter = await GetWithAuthAsync("/api/v1/vendors", accessToken);
        var contentAfter = await getAfter.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        contentAfter!.Items.Should().NotContain(v => v.Id == vendorId);
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

    private async Task<Guid> CreateVendorAsync(string accessToken, string firstName, string lastName)
    {
        var request = new { FirstName = firstName, LastName = lastName };
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", request, accessToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CreateVendorResponse>();
        return content!.Id;
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> GetWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }
}
