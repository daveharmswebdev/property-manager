using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for ReceiptsController (AC-5.1.1 through AC-5.1.7).
/// </summary>
public class ReceiptsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ReceiptsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    #region POST /api/v1/receipts/upload-url Tests

    [Fact]
    public async Task GenerateUploadUrl_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/receipts/upload-url", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateUploadUrl_WithValidRequest_Returns200WithPresignedUrl()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/receipts/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ReceiptsUploadUrlResponse>();
        content.Should().NotBeNull();
        content!.UploadUrl.Should().StartWith("https://");
        content.StorageKey.Should().NotBeNullOrEmpty();
        content.HttpMethod.Should().Be("PUT");
        content.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task GenerateUploadUrl_WithInvalidContentType_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            ContentType = "image/gif", // Not allowed
            FileSizeBytes = 1024 * 1024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/receipts/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("ContentType");
    }

    [Fact]
    public async Task GenerateUploadUrl_WithFileSizeOver10MB_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = (10 * 1024 * 1024) + 1 // 10MB + 1 byte
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/receipts/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("FileSizeBytes");
    }

    #endregion

    #region POST /api/v1/receipts Tests

    [Fact]
    public async Task CreateReceipt_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            StorageKey = "test-account/2025/test.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/receipts", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateReceipt_WithValidRequest_Returns201WithId()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            StorageKey = $"{Guid.NewGuid()}/2025/{Guid.NewGuid()}.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/receipts", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<ReceiptsCreateResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBe(Guid.Empty);

        // Verify Location header is present
        response.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateReceipt_WithMissingStorageKey_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new
        {
            StorageKey = "",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/receipts", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("StorageKey");
    }

    #endregion

    #region GET /api/v1/receipts/{id} Tests

    [Fact]
    public async Task GetReceipt_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.GetAsync($"/api/v1/receipts/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetReceipt_WithValidId_Returns200WithViewUrl()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // First create a receipt
        var createRequest = new
        {
            StorageKey = $"{Guid.NewGuid()}/2025/{Guid.NewGuid()}.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/receipts", createRequest, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<ReceiptsCreateResponse>();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/receipts/{createContent!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ReceiptsDetailDto>();
        content.Should().NotBeNull();
        content!.Id.Should().Be(createContent.Id);
        content.OriginalFileName.Should().Be("receipt.jpg");
        content.ContentType.Should().Be("image/jpeg");
        content.ViewUrl.Should().StartWith("https://");
    }

    [Fact]
    public async Task GetReceipt_WithNonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/receipts/{Guid.NewGuid()}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region DELETE /api/v1/receipts/{id} Tests

    [Fact]
    public async Task DeleteReceipt_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.DeleteAsync($"/api/v1/receipts/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteReceipt_WithValidId_Returns204()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // First create a receipt
        var createRequest = new
        {
            StorageKey = $"{Guid.NewGuid()}/2025/{Guid.NewGuid()}.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/receipts", createRequest, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<ReceiptsCreateResponse>();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/receipts/{createContent!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify the receipt is no longer accessible
        var getResponse = await GetWithAuthAsync($"/api/v1/receipts/{createContent.Id}", accessToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteReceipt_WithNonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/receipts/{Guid.NewGuid()}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Account Isolation Tests

    [Fact]
    public async Task GetReceipt_FromDifferentAccount_Returns404()
    {
        // Arrange - Create a receipt with first user
        var email1 = $"user1-isolation-{Guid.NewGuid():N}@test.com";
        var (accessToken1, _) = await RegisterAndLoginAsync(email1);

        var createRequest = new
        {
            StorageKey = $"{Guid.NewGuid()}/2025/{Guid.NewGuid()}.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024
        };

        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/receipts", createRequest, accessToken1);
        var createContent = await createResponse.Content.ReadFromJsonAsync<ReceiptsCreateResponse>();

        // Create a second user and try to access the receipt
        var email2 = $"user2-isolation-{Guid.NewGuid():N}@test.com";
        var (accessToken2, _) = await RegisterAndLoginAsync(email2);

        // Act - Try to get the receipt created by user1 using user2's token
        var response = await GetWithAuthAsync($"/api/v1/receipts/{createContent!.Id}", accessToken2);

        // Assert - Should return 404 due to account isolation
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Helper Methods

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

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<ReceiptsLoginResponse>();
        return (loginContent!.AccessToken, userId);
    }

    private async Task<string> GetAccessTokenForUserAsync(string email, Guid accountId)
    {
        var password = "Test@123456";

        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new { Email = email, Password = password });
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<ReceiptsLoginResponse>();

        return loginContent!.AccessToken;
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(content)
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> GetWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        return await _client.SendAsync(request);
    }

    #endregion
}

#region Response Types

public record ReceiptsUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    DateTime ExpiresAt,
    string HttpMethod
);

public record ReceiptsCreateResponse(Guid Id);

public record ReceiptsDetailDto(
    Guid Id,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId,
    Guid? ExpenseId,
    DateTime CreatedAt,
    DateTime? ProcessedAt,
    string ViewUrl
);

public record ReceiptsLoginResponse(string AccessToken, int ExpiresIn);

#endregion
