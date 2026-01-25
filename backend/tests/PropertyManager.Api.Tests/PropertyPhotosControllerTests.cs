using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for PropertyPhotosController.
/// Tests property photo management endpoints including upload URL generation,
/// upload confirmation, listing, deletion, primary setting, and reordering.
/// </summary>
public class PropertyPhotosControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public PropertyPhotosControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/properties/{propertyId}/photos/upload-url Tests
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/properties/{propertyId}/photos/upload-url", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateUploadUrl_WithValidData_ReturnsPresignedUrl()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "property-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<PropertyPhotoUploadUrlResponse>();
        content.Should().NotBeNull();
        content!.UploadUrl.Should().NotBeNullOrEmpty();
        content.StorageKey.Should().NotBeNullOrEmpty();
        content.ThumbnailStorageKey.Should().NotBeNullOrEmpty();
        content.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task GenerateUploadUrl_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentPropertyId = Guid.NewGuid();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{nonExistentPropertyId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_OtherAccountProperty_Returns404()
    {
        // Arrange
        var (_, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act - User 2 tries to generate upload URL for User 1's property
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId1}/photos/upload-url", request, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_InvalidContentType_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            ContentType = "text/plain",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeTooLarge_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var maxSize = PhotoValidation.MaxFileSizeBytes;
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = maxSize + 1,
            OriginalFileName = "large.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyFileName_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = ""
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // POST /api/v1/properties/{propertyId}/photos Tests (Confirm Upload)
    // =====================================================

    [Fact]
    public async Task ConfirmUpload_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var request = new
        {
            StorageKey = $"{Guid.NewGuid()}/properties/2024/test.jpg",
            ThumbnailStorageKey = $"{Guid.NewGuid()}/properties/2024/test_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/properties/{propertyId}/photos", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ConfirmUpload_WithValidData_Returns201()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();
        var storageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg";
        var request = new
        {
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "property-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ConfirmUpload_FirstPhoto_SetsPrimaryAutomatically()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();
        var storageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg";
        var request = new
        {
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first-photo.jpg"
        };

        // Act
        await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", request, accessToken);

        // Assert - Check database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = await dbContext.PropertyPhotos
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.PropertyId == propertyId);

        photo.Should().NotBeNull();
        photo!.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task ConfirmUpload_SecondPhoto_NotSetAsPrimary()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();

        // Create first photo
        await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first.jpg"
        }, accessToken);

        // Create second photo
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "second.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        // Assert
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var secondPhoto = await dbContext.PropertyPhotos
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == content!.Id);

        secondPhoto.Should().NotBeNull();
        secondPhoto!.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task ConfirmUpload_NonExistentProperty_Returns404()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var nonExistentPropertyId = Guid.NewGuid();
        var request = new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{nonExistentPropertyId}/photos", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ConfirmUpload_OtherAccountStorageKey_Returns403()
    {
        // Arrange
        var (accessToken, propertyId, _) = await CreateUserWithPropertyAndAccountIdAsync();
        var otherAccountId = Guid.NewGuid();
        var request = new
        {
            StorageKey = $"{otherAccountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{otherAccountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // =====================================================
    // GET /api/v1/properties/{propertyId}/photos Tests
    // =====================================================

    [Fact]
    public async Task GetPhotos_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/properties/{propertyId}/photos");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPhotos_EmptyProperty_ReturnsEmptyList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/photos", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetPropertyPhotosResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPhotos_WithPhotos_ReturnsOrderedList()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();

        // Create two photos
        await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1000L,
            OriginalFileName = "first.jpg"
        }, accessToken);

        await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/png",
            FileSizeBytes = 2000L,
            OriginalFileName = "second.png"
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/photos", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetPropertyPhotosResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(2);
        content.Items[0].DisplayOrder.Should().Be(0);
        content.Items[1].DisplayOrder.Should().Be(1);
        content.Items[0].IsPrimary.Should().BeTrue();
        content.Items[1].IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task GetPhotos_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentPropertyId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{nonExistentPropertyId}/photos", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_OtherAccountProperty_Returns404()
    {
        // Arrange
        var (_, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId1}/photos", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // DELETE /api/v1/properties/{propertyId}/photos/{photoId} Tests
    // =====================================================

    [Fact]
    public async Task DeletePhoto_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/v1/properties/{propertyId}/photos/{photoId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeletePhoto_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();

        // Create a photo
        var createResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "to-delete.jpg"
        }, accessToken);
        var photo = await createResponse.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/properties/{propertyId}/photos/{photo!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeletePhoto_NonExistentPhoto_Returns404()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var nonExistentPhotoId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/properties/{propertyId}/photos/{nonExistentPhotoId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_OtherAccountPhoto_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1, accountId1) = await CreateUserWithPropertyAndAccountIdAsync();
        var (accessToken2, propertyId2, _) = await CreateUserWithPropertyAndAccountIdAsync();

        // Create photo for user 1
        var createResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId1}/photos", new
        {
            StorageKey = $"{accountId1}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId1}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "user1-photo.jpg"
        }, accessToken1);
        var photo = await createResponse.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        // Act - User 2 tries to delete User 1's photo
        var response = await DeleteWithAuthAsync($"/api/v1/properties/{propertyId2}/photos/{photo!.Id}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // PUT /api/v1/properties/{propertyId}/photos/{photoId}/primary Tests
    // =====================================================

    [Fact]
    public async Task SetPrimaryPhoto_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        // Act
        var response = await _client.PutAsync($"/api/v1/properties/{propertyId}/photos/{photoId}/primary", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SetPrimaryPhoto_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();

        // Create two photos
        await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first.jpg"
        }, accessToken);

        var secondResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "second.jpg"
        }, accessToken);
        var secondPhoto = await secondResponse.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        // Act - Set second photo as primary
        var response = await PutWithAuthAsync($"/api/v1/properties/{propertyId}/photos/{secondPhoto!.Id}/primary", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photos = await dbContext.PropertyPhotos
            .IgnoreQueryFilters()
            .Where(p => p.PropertyId == propertyId)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync();

        photos.Should().HaveCount(2);
        photos[0].IsPrimary.Should().BeFalse();
        photos[1].IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task SetPrimaryPhoto_NonExistentPhoto_Returns404()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var nonExistentPhotoId = Guid.NewGuid();

        // Act
        var response = await PutWithAuthAsync($"/api/v1/properties/{propertyId}/photos/{nonExistentPhotoId}/primary", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // PUT /api/v1/properties/{propertyId}/photos/reorder Tests
    // =====================================================

    [Fact]
    public async Task ReorderPhotos_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var request = new { PhotoIds = new List<Guid> { Guid.NewGuid() } };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/v1/properties/{propertyId}/photos/reorder", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ReorderPhotos_ValidOrder_Returns204()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();

        // Create two photos
        var firstResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first.jpg"
        }, accessToken);
        var firstPhoto = await firstResponse.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        var secondResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "second.jpg"
        }, accessToken);
        var secondPhoto = await secondResponse.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        // Reorder: second first, first second
        var request = new { PhotoIds = new List<Guid> { secondPhoto!.Id, firstPhoto!.Id } };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/reorder", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify order changed in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photos = await dbContext.PropertyPhotos
            .IgnoreQueryFilters()
            .Where(p => p.PropertyId == propertyId)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync();

        photos[0].Id.Should().Be(secondPhoto.Id);
        photos[1].Id.Should().Be(firstPhoto.Id);
    }

    [Fact]
    public async Task ReorderPhotos_EmptyPhotoIds_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new { PhotoIds = new List<Guid>() };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/reorder", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReorderPhotos_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentPropertyId = Guid.NewGuid();
        var request = new { PhotoIds = new List<Guid> { Guid.NewGuid() } };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/properties/{nonExistentPropertyId}/photos/reorder", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // End-to-End Flow Test
    // =====================================================

    [Fact]
    public async Task PropertyPhotoFlow_FullCycle_Succeeds()
    {
        // Arrange
        var (accessToken, propertyId, accountId) = await CreateUserWithPropertyAndAccountIdAsync();

        // Step 1: Generate upload URL
        var uploadUrlResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos/upload-url", new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 5000L,
            OriginalFileName = "test-photo.jpg"
        }, accessToken);
        uploadUrlResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadUrl = await uploadUrlResponse.Content.ReadFromJsonAsync<PropertyPhotoUploadUrlResponse>();

        // Step 2: Confirm upload
        var confirmResponse = await PostAsJsonWithAuthAsync($"/api/v1/properties/{propertyId}/photos", new
        {
            StorageKey = uploadUrl!.StorageKey,
            ThumbnailStorageKey = uploadUrl.ThumbnailStorageKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 5000L,
            OriginalFileName = "test-photo.jpg"
        }, accessToken);
        confirmResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var photo = await confirmResponse.Content.ReadFromJsonAsync<PropertyPhotoConfirmResponse>();

        // Step 3: Get photos
        var getResponse = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/photos", accessToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var photos = await getResponse.Content.ReadFromJsonAsync<GetPropertyPhotosResponse>();
        photos!.Items.Should().HaveCount(1);
        photos.Items[0].Id.Should().Be(photo!.Id);

        // Step 4: Delete photo
        var deleteResponse = await DeleteWithAuthAsync($"/api/v1/properties/{propertyId}/photos/{photo.Id}", accessToken);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify deletion
        var getAfterDelete = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/photos", accessToken);
        var photosAfterDelete = await getAfterDelete.Content.ReadFromJsonAsync<GetPropertyPhotosResponse>();
        photosAfterDelete!.Items.Should().BeEmpty();
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
        var email = $"property-photos-test-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        var (_, accountId) = await _factory.CreateTestUserAsync(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, accountId);
    }

    private async Task<(string AccessToken, Guid PropertyId)> CreateUserWithPropertyAsync()
    {
        var (accessToken, propertyId, _) = await CreateUserWithPropertyAndAccountIdAsync();
        return (accessToken, propertyId);
    }

    private async Task<(string AccessToken, Guid PropertyId, Guid AccountId)> CreateUserWithPropertyAndAccountIdAsync()
    {
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();

        var propertyRequest = new
        {
            Name = "Test Property for Photos",
            Street = "123 Photo Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var propertyResponse = await PostAsJsonWithAuthAsync("/api/v1/properties", propertyRequest, accessToken);
        var propertyContent = await propertyResponse.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        return (accessToken, propertyContent!.Id, accountId);
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

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PutWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PutAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }
}

// =====================================================
// Response DTOs
// =====================================================

file record PropertyPhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

file record PropertyPhotoConfirmResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

file record GetPropertyPhotosResponse(
    IReadOnlyList<PropertyPhotoDto> Items);

file record PropertyPhotoDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string OriginalFileName,
    long FileSizeBytes,
    DateTime CreatedAt);

file record CreatePropertyResponse(Guid Id);

file record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt);
