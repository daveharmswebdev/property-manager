using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for PhotosController.
/// Tests presigned URL generation and upload confirmation endpoints.
/// </summary>
public class PhotosControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public PhotosControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/photos/upload-url Tests
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/photos/upload-url", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateUploadUrl_WithValidData_ReturnsPresignedUrl()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<UploadUrlResponse>();
        content.Should().NotBeNull();
        content!.UploadUrl.Should().NotBeNullOrEmpty();
        content.StorageKey.Should().NotBeNullOrEmpty();
        content.ThumbnailStorageKey.Should().NotBeNullOrEmpty();
        content.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Theory]
    [InlineData(PhotoEntityType.Properties)]
    [InlineData(PhotoEntityType.Receipts)]
    [InlineData(PhotoEntityType.Vendors)]
    [InlineData(PhotoEntityType.Users)]
    public async Task GenerateUploadUrl_AllEntityTypes_ReturnsSuccess(PhotoEntityType entityType)
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = entityType,
            EntityId = Guid.NewGuid(),
            ContentType = "image/png",
            FileSizeBytes = 2048L,
            OriginalFileName = "photo.png"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/gif")]
    [InlineData("image/webp")]
    [InlineData("image/bmp")]
    [InlineData("image/tiff")]
    public async Task GenerateUploadUrl_AllowedContentTypes_ReturnsSuccess(string contentType)
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = contentType,
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("text/plain")]
    [InlineData("application/pdf")]
    [InlineData("video/mp4")]
    [InlineData("image/svg+xml")]
    public async Task GenerateUploadUrl_InvalidContentType_Returns400(string contentType)
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = contentType,
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeTooLarge_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var maxSize = PhotoValidation.MaxFileSizeBytes;
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = maxSize + 1,
            OriginalFileName = "large-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeZero_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = 0L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_NegativeFileSize_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = -1L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyEntityId_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.Empty,
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyContentType_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyFileName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = ""
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_FileNameTooLong_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var longFileName = new string('a', 256) + ".jpg"; // 260 chars, exceeds 255 limit
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = longFileName
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_MaxFileSize_ReturnsSuccess()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var maxSize = PhotoValidation.MaxFileSizeBytes;
        var request = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = maxSize,
            OriginalFileName = "max-size-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // =====================================================
    // POST /api/v1/photos/confirm Tests
    // =====================================================

    [Fact]
    public async Task ConfirmUpload_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            StorageKey = $"{Guid.NewGuid()}/properties/2024/test.jpg",
            ThumbnailStorageKey = $"{Guid.NewGuid()}/properties/2024/test_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/photos/confirm", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ConfirmUpload_WithValidData_ReturnsConfirmedDetails()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var storageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg";
        var request = new
        {
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ConfirmUploadResponse>();
        content.Should().NotBeNull();
        content!.StorageKey.Should().Be(storageKey);
        // ThumbnailStorageKey may be null in NoOp implementation
        content.ContentType.Should().Be("image/jpeg");
        content.FileSizeBytes.Should().Be(1024L);
    }

    [Fact]
    public async Task ConfirmUpload_OtherAccountStorageKey_Returns403()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var otherAccountId = Guid.NewGuid();
        var request = new
        {
            StorageKey = $"{otherAccountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{otherAccountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ConfirmUpload_InvalidStorageKeyFormat_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            StorageKey = "invalid-format-no-guid",
            ThumbnailStorageKey = "invalid-thumb",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_EmptyStorageKey_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var request = new
        {
            StorageKey = "",
            ThumbnailStorageKey = $"{accountId}/properties/2024/thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_EmptyThumbnailStorageKey_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = "",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_EmptyContentType_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_InvalidContentType_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "text/plain",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_FileSizeZero_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 0L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_FileSizeTooLarge_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var maxSize = PhotoValidation.MaxFileSizeBytes;
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = maxSize + 1
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_StorageKeyTooLong_Returns400()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var longKey = $"{accountId}/properties/2024/{new string('a', 500)}.jpg"; // Exceeds 500 char limit
        var request = new
        {
            StorageKey = longKey,
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // End-to-End Flow Test
    // =====================================================

    [Fact]
    public async Task PhotoUploadFlow_GenerateUrlThenConfirm_Succeeds()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();

        // Step 1: Generate upload URL
        var uploadRequest = new
        {
            EntityType = PhotoEntityType.Properties,
            EntityId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            FileSizeBytes = 5000L,
            OriginalFileName = "property-photo.jpg"
        };

        var uploadResponse = await PostAsJsonWithAuthAsync("/api/v1/photos/upload-url", uploadRequest, accessToken);
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadResult = await uploadResponse.Content.ReadFromJsonAsync<UploadUrlResponse>();
        uploadResult.Should().NotBeNull();

        // Step 2: Confirm upload (simulating that the file was uploaded to S3)
        var confirmRequest = new
        {
            StorageKey = uploadResult!.StorageKey,
            ThumbnailStorageKey = uploadResult.ThumbnailStorageKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 5000L
        };

        var confirmResponse = await PostAsJsonWithAuthAsync("/api/v1/photos/confirm", confirmRequest, accessToken);
        confirmResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var confirmResult = await confirmResponse.Content.ReadFromJsonAsync<ConfirmUploadResponse>();
        confirmResult.Should().NotBeNull();
        confirmResult!.StorageKey.Should().Be(uploadResult.StorageKey);
        // ThumbnailStorageKey may be null in NoOp implementation - just verify main key is preserved
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var (accessToken, _) = await GetAccessTokenWithAccountIdAsync();
        return accessToken;
    }

    private async Task<(string AccessToken, Guid AccountId)> GetAccessTokenWithAccountIdAsync()
    {
        var email = $"photos-test-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        // Create user directly in database
        var (_, accountId) = await _factory.CreateTestUserAsync(email, password);

        // Login
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, accountId);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }
}

// =====================================================
// Response DTOs
// =====================================================

file record UploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

file record ConfirmUploadResponse(
    string StorageKey,
    string? ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes);

file record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt);
