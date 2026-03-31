using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for VendorPhotosController.
/// Tests vendor photo management endpoints including upload URL generation,
/// upload confirmation, listing, deletion, primary setting, and reordering.
/// </summary>
public class VendorPhotosControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public VendorPhotosControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/vendors/{vendorId}/photos/upload-url Tests
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateUploadUrl_WithValidData_ReturnsPresignedUrl()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "vendor-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<VendorPhotoUploadUrlResponse>();
        content.Should().NotBeNull();
        content!.UploadUrl.Should().NotBeNullOrEmpty();
        content.StorageKey.Should().NotBeNullOrEmpty();
        content.ThumbnailStorageKey.Should().NotBeNullOrEmpty();
        content.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task GenerateUploadUrl_NonExistentVendor_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentVendorId = Guid.NewGuid();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{nonExistentVendorId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_OtherAccountVendor_Returns404()
    {
        // Arrange
        var (_, vendorId1) = await CreateUserWithVendorAsync();
        var accessToken2 = await GetAccessTokenAsync();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act - User 2 tries to generate upload URL for User 1's vendor
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId1}/photos/upload-url", request, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_InvalidContentType_Returns400()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var request = new
        {
            ContentType = "text/plain",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeTooLarge_Returns400()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var maxSize = PhotoValidation.MaxFileSizeBytes;
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = maxSize + 1,
            OriginalFileName = "large.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyFileName_Returns400()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var request = new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = ""
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // POST /api/v1/vendors/{vendorId}/photos Tests (Confirm Upload)
    // =====================================================

    [Fact]
    public async Task ConfirmUpload_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var request = new
        {
            StorageKey = $"{Guid.NewGuid()}/vendors/2024/test.jpg",
            ThumbnailStorageKey = $"{Guid.NewGuid()}/vendors/2024/test_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/vendors/{vendorId}/photos", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ConfirmUpload_WithValidData_Returns201()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();
        var storageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg";
        var request = new
        {
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "vendor-photo.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ConfirmUpload_FirstPhoto_SetsPrimaryAutomatically()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();
        var storageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg";
        var request = new
        {
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first-photo.jpg"
        };

        // Act
        await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", request, accessToken);

        // Assert - Check database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = await dbContext.VendorPhotos
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.VendorId == vendorId);

        photo.Should().NotBeNull();
        photo!.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task ConfirmUpload_SecondPhoto_NotSetAsPrimary()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();

        // Create first photo
        await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first.jpg"
        }, accessToken);

        // Create second photo
        var request = new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "second.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", request, accessToken);
        var content = await response.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Assert
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var secondPhoto = await dbContext.VendorPhotos
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == content!.Id);

        secondPhoto.Should().NotBeNull();
        secondPhoto!.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task ConfirmUpload_NonExistentVendor_Returns404()
    {
        // Arrange
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();
        var nonExistentVendorId = Guid.NewGuid();
        var request = new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "test.jpg"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{nonExistentVendorId}/photos", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // GET /api/v1/vendors/{vendorId}/photos Tests
    // =====================================================

    [Fact]
    public async Task GetPhotos_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/vendors/{vendorId}/photos");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPhotos_EmptyVendor_ReturnsEmptyList()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetVendorPhotosResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPhotos_WithPhotos_ReturnsOrderedList()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();

        // Create two photos
        await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1000L,
            OriginalFileName = "first.jpg"
        }, accessToken);

        await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/png",
            FileSizeBytes = 2000L,
            OriginalFileName = "second.png"
        }, accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetVendorPhotosResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(2);
        content.Items[0].DisplayOrder.Should().Be(0);
        content.Items[1].DisplayOrder.Should().Be(1);
        content.Items[0].IsPrimary.Should().BeTrue();
        content.Items[1].IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task GetPhotos_NonExistentVendor_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentVendorId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/vendors/{nonExistentVendorId}/photos", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_OtherAccountVendor_Returns404()
    {
        // Arrange
        var (_, vendorId1) = await CreateUserWithVendorAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId1}/photos", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // DELETE /api/v1/vendors/{vendorId}/photos/{photoId} Tests
    // =====================================================

    [Fact]
    public async Task DeletePhoto_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/v1/vendors/{vendorId}/photos/{photoId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeletePhoto_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();

        // Create a photo
        var createResponse = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "to-delete.jpg"
        }, accessToken);
        var photo = await createResponse.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/{photo!.Id}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeletePhoto_NonExistentPhoto_Returns404()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var nonExistentPhotoId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/{nonExistentPhotoId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_OtherAccountPhoto_Returns404()
    {
        // Arrange
        var (accessToken1, vendorId1, accountId1) = await CreateUserWithVendorAndAccountIdAsync();
        var (accessToken2, vendorId2, _) = await CreateUserWithVendorAndAccountIdAsync();

        // Create photo for user 1
        var createResponse = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId1}/photos", new
        {
            StorageKey = $"{accountId1}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId1}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "user1-photo.jpg"
        }, accessToken1);
        var photo = await createResponse.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Act - User 2 tries to delete User 1's photo
        var response = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId2}/photos/{photo!.Id}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // PUT /api/v1/vendors/{vendorId}/photos/{photoId}/primary Tests
    // =====================================================

    [Fact]
    public async Task SetPrimaryPhoto_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        // Act
        var response = await _client.PutAsync($"/api/v1/vendors/{vendorId}/photos/{photoId}/primary", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SetPrimaryPhoto_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();

        // Create two photos
        await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first.jpg"
        }, accessToken);

        var secondResponse = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "second.jpg"
        }, accessToken);
        var secondPhoto = await secondResponse.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Act - Set second photo as primary
        var response = await PutWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/{secondPhoto!.Id}/primary", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photos = await dbContext.VendorPhotos
            .IgnoreQueryFilters()
            .Where(p => p.VendorId == vendorId)
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
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var nonExistentPhotoId = Guid.NewGuid();

        // Act
        var response = await PutWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/{nonExistentPhotoId}/primary", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // PUT /api/v1/vendors/{vendorId}/photos/reorder Tests
    // =====================================================

    [Fact]
    public async Task ReorderPhotos_WithoutAuth_Returns401()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var request = new { PhotoIds = new List<Guid> { Guid.NewGuid() } };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/v1/vendors/{vendorId}/photos/reorder", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ReorderPhotos_ValidOrder_Returns204()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();

        // Create two photos
        var firstResponse = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "first.jpg"
        }, accessToken);
        var firstPhoto = await firstResponse.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        var secondResponse = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2024/{Guid.NewGuid()}_thumb.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024L,
            OriginalFileName = "second.jpg"
        }, accessToken);
        var secondPhoto = await secondResponse.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Reorder: second first, first second
        var request = new { PhotoIds = new List<Guid> { secondPhoto!.Id, firstPhoto!.Id } };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/reorder", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify order changed in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photos = await dbContext.VendorPhotos
            .IgnoreQueryFilters()
            .Where(p => p.VendorId == vendorId)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync();

        photos[0].Id.Should().Be(secondPhoto.Id);
        photos[1].Id.Should().Be(firstPhoto.Id);
    }

    [Fact]
    public async Task ReorderPhotos_EmptyPhotoIds_Returns400()
    {
        // Arrange
        var (accessToken, vendorId) = await CreateUserWithVendorAsync();
        var request = new { PhotoIds = new List<Guid>() };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/reorder", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReorderPhotos_NonExistentVendor_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentVendorId = Guid.NewGuid();
        var request = new { PhotoIds = new List<Guid> { Guid.NewGuid() } };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/vendors/{nonExistentVendorId}/photos/reorder", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // End-to-End Flow Test
    // =====================================================

    [Fact]
    public async Task VendorPhotoFlow_FullCycle_Succeeds()
    {
        // Arrange
        var (accessToken, vendorId, accountId) = await CreateUserWithVendorAndAccountIdAsync();

        // Step 1: Generate upload URL
        var uploadUrlResponse = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", new
        {
            ContentType = "image/jpeg",
            FileSizeBytes = 5000L,
            OriginalFileName = "test-photo.jpg"
        }, accessToken);
        uploadUrlResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var uploadUrl = await uploadUrlResponse.Content.ReadFromJsonAsync<VendorPhotoUploadUrlResponse>();

        // Step 2: Confirm upload (first photo)
        var confirmResponse1 = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = uploadUrl!.StorageKey,
            ThumbnailStorageKey = uploadUrl.ThumbnailStorageKey,
            ContentType = "image/jpeg",
            FileSizeBytes = 5000L,
            OriginalFileName = "test-photo.jpg"
        }, accessToken);
        confirmResponse1.StatusCode.Should().Be(HttpStatusCode.Created);

        var photo1 = await confirmResponse1.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Step 3: Confirm upload (second photo)
        var uploadUrlResponse2 = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/upload-url", new
        {
            ContentType = "image/png",
            FileSizeBytes = 3000L,
            OriginalFileName = "test-photo-2.png"
        }, accessToken);
        var uploadUrl2 = await uploadUrlResponse2.Content.ReadFromJsonAsync<VendorPhotoUploadUrlResponse>();

        var confirmResponse2 = await PostAsJsonWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", new
        {
            StorageKey = uploadUrl2!.StorageKey,
            ThumbnailStorageKey = uploadUrl2.ThumbnailStorageKey,
            ContentType = "image/png",
            FileSizeBytes = 3000L,
            OriginalFileName = "test-photo-2.png"
        }, accessToken);
        confirmResponse2.StatusCode.Should().Be(HttpStatusCode.Created);

        var photo2 = await confirmResponse2.Content.ReadFromJsonAsync<VendorPhotoConfirmResponse>();

        // Step 4: Get photos - verify both exist
        var getResponse = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", accessToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var photos = await getResponse.Content.ReadFromJsonAsync<GetVendorPhotosResponse>();
        photos!.Items.Should().HaveCount(2);
        photos.Items[0].Id.Should().Be(photo1!.Id);
        photos.Items[0].IsPrimary.Should().BeTrue();

        // Step 5: Set second photo as primary
        var setPrimaryResponse = await PutWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/{photo2!.Id}/primary", accessToken);
        setPrimaryResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 6: Delete first photo
        var deleteResponse = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}/photos/{photo1.Id}", accessToken);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 7: Verify final state
        var getAfterDelete = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}/photos", accessToken);
        var photosAfterDelete = await getAfterDelete.Content.ReadFromJsonAsync<GetVendorPhotosResponse>();
        photosAfterDelete!.Items.Should().HaveCount(1);
        photosAfterDelete.Items[0].Id.Should().Be(photo2.Id);
        photosAfterDelete.Items[0].IsPrimary.Should().BeTrue();
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
        var email = $"vendor-photos-test-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        var (_, accountId) = await _factory.CreateTestUserAsync(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<VendorPhotosLoginResponse>();
        return (loginContent!.AccessToken, accountId);
    }

    private async Task<(string AccessToken, Guid VendorId)> CreateUserWithVendorAsync()
    {
        var (accessToken, vendorId, _) = await CreateUserWithVendorAndAccountIdAsync();
        return (accessToken, vendorId);
    }

    private async Task<(string AccessToken, Guid VendorId, Guid AccountId)> CreateUserWithVendorAndAccountIdAsync()
    {
        var (accessToken, accountId) = await GetAccessTokenWithAccountIdAsync();

        var vendorRequest = new
        {
            FirstName = "Test",
            LastName = "Vendor",
            Phones = new List<object>(),
            Emails = new List<string>(),
            TradeTagIds = new List<Guid>()
        };
        var vendorResponse = await PostAsJsonWithAuthAsync("/api/v1/vendors", vendorRequest, accessToken);
        var vendorContent = await vendorResponse.Content.ReadFromJsonAsync<CreateVendorResponseDto>();

        return (accessToken, vendorContent!.Id, accountId);
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

file record VendorPhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

file record VendorPhotoConfirmResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

file record GetVendorPhotosResponse(
    IReadOnlyList<VendorPhotoDto> Items);

file record VendorPhotoDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string OriginalFileName,
    long FileSizeBytes,
    DateTime CreatedAt);

file record CreateVendorResponseDto(Guid Id);

file record VendorPhotosLoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt);
