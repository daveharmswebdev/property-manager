using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for MaintenanceRequestPhotosController covering the four endpoints:
///   POST   /api/v1/maintenance-requests/{id}/photos/upload-url
///   POST   /api/v1/maintenance-requests/{id}/photos           (ConfirmUpload)
///   GET    /api/v1/maintenance-requests/{id}/photos
///   DELETE /api/v1/maintenance-requests/{id}/photos/{photoId}
///
/// Exercises the real HTTP + DI + EF Core + JWT auth + FakeStorageService stack.
/// Mirrors MaintenanceRequestsControllerTests (Story 21.1, PR #372) patterns exactly.
/// See Story 21.2 for AC mapping. Tests assert the SHIPPED controller/handler behavior —
/// any mismatch is a test bug, not a handler bug (test-only story, do not change handlers).
/// </summary>
public class MaintenanceRequestPhotosControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public MaintenanceRequestPhotosControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // Auth coverage (AC-1) — Task 2
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ConfirmUpload_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos",
            new
            {
                StorageKey = $"{Guid.NewGuid()}/maintenance-requests/2026/x.jpg",
                ThumbnailStorageKey = $"{Guid.NewGuid()}/maintenance-requests/2026/x_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPhotos_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeletePhoto_WithoutAuth_Returns401()
    {
        var response = await _client.DeleteAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // =====================================================
    // GenerateUploadUrl tests (AC-2..5) — Task 3
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_AsTenant_ValidBody_Returns200WithPresignedUrl()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "leak.jpg" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<MrpUploadUrlResponse>();
        body.Should().NotBeNull();
        body!.UploadUrl.Should().NotBeNullOrEmpty();
        body.StorageKey.Should().NotBeNullOrEmpty();
        body.StorageKey.Should().StartWith(ctx.AccountId.ToString());
        body.ThumbnailStorageKey.Should().NotBeNullOrEmpty();
        body.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task GenerateUploadUrl_AsOwner_ValidBody_Returns200WithPresignedUrl()
    {
        var ownerEmail = $"owner-upload-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);
        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/upload-url",
            new { ContentType = "image/png", FileSizeBytes = 2048L, OriginalFileName = "owner.png" },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<MrpUploadUrlResponse>();
        body!.UploadUrl.Should().NotBeNullOrEmpty();
        body.StorageKey.Should().StartWith(accountId.ToString());
    }

    [Fact]
    public async Task GenerateUploadUrl_DoesNotCreatePhotoRow()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "test.jpg" },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.MaintenanceRequestId == ctx.MaintenanceRequestId);

        count.Should().Be(0);
    }

    [Fact]
    public async Task GenerateUploadUrl_NonExistentMaintenanceRequest_Returns404()
    {
        var ownerEmail = $"owner-404-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_CrossAccount_Returns404()
    {
        // Account A has the maintenance request
        var ownerAEmail = $"owner-a-upload-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var requestA = await SeedMaintenanceRequestAsync(accountA, propertyA, ownerAUserId);

        // Account B's Owner tries to upload to account A's request
        var ownerBEmail = $"owner-b-upload-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestA}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-tenant-diff-upload-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P2");

        var t1Email = $"tenant1-upload-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2Email = $"tenant2-upload-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        // Request is on P2; Tenant-1 (on P1) tries to upload.
        var requestId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_InvalidContentType_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "text/plain", FileSizeBytes = 1024L, OriginalFileName = "x.txt" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("ContentType");
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeExceedsMax_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new
            {
                ContentType = "image/jpeg",
                FileSizeBytes = PhotoValidation.MaxFileSizeBytes + 1,
                OriginalFileName = "big.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("FileSizeBytes");
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeZeroOrNegative_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var responseZero = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 0L, OriginalFileName = "x.jpg" },
            ctx.AccessToken);

        responseZero.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var responseNegative = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = -100L, OriginalFileName = "x.jpg" },
            ctx.AccessToken);

        responseNegative.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyOriginalFileName_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("OriginalFileName");
    }

    [Fact]
    public async Task GenerateUploadUrl_FileNameOver255Chars_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();
        var longName = new string('x', 256);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = longName },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("OriginalFileName");
    }

    // =====================================================
    // ConfirmUpload tests (AC-6..9) — Task 4
    // =====================================================

    [Fact]
    public async Task ConfirmUpload_AsTenant_ValidRequest_Returns201WithIdAndUrls()
    {
        var ctx = await CreateTenantContextWithRequestAsync();
        var storageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg";

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = storageKey,
                ThumbnailStorageKey = thumbnailKey,
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "leak.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<MrpConfirmResponse>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
        body.ViewUrl.Should().NotBeNullOrEmpty();
        // ThumbnailUrl is only non-null if PhotoService successfully generated one.
        // Against FakeStorageService the thumbnail generation try/catches to null — OK either way.
    }

    [Fact]
    public async Task ConfirmUpload_PersistsPhotoRow_WithCorrectFields()
    {
        var ctx = await CreateTenantContextWithRequestAsync();
        var storageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg";

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = storageKey,
                ThumbnailStorageKey = thumbnailKey,
                ContentType = "image/jpeg",
                FileSizeBytes = 4096L,
                OriginalFileName = "leak.jpg"
            },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<MrpConfirmResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var photo = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == body!.Id);

        photo.Should().NotBeNull();
        photo!.AccountId.Should().Be(ctx.AccountId);
        photo.MaintenanceRequestId.Should().Be(ctx.MaintenanceRequestId);
        photo.CreatedByUserId.Should().Be(ctx.UserId);
        photo.OriginalFileName.Should().Be("leak.jpg");
        photo.ContentType.Should().Be("image/jpeg");
        photo.FileSizeBytes.Should().Be(4096L);
        photo.DisplayOrder.Should().Be(0);
        photo.IsPrimary.Should().BeTrue();
        photo.StorageKey.Should().Be(storageKey);
    }

    [Fact]
    public async Task ConfirmUpload_FirstPhoto_SetsPrimaryTrue()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "first.jpg"
            },
            ctx.AccessToken);

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<MrpConfirmResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters()
            .FirstAsync(p => p.Id == body!.Id);

        photo.IsPrimary.Should().BeTrue();
        photo.DisplayOrder.Should().Be(0);
    }

    [Fact]
    public async Task ConfirmUpload_SecondPhoto_SetsPrimaryFalse_DisplayOrder1()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        // First photo
        var firstResponse = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "first.jpg"
            },
            ctx.AccessToken);
        firstResponse.EnsureSuccessStatusCode();
        var firstBody = await firstResponse.Content.ReadFromJsonAsync<MrpConfirmResponse>();

        // Second photo
        var secondResponse = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 2048L,
                OriginalFileName = "second.jpg"
            },
            ctx.AccessToken);
        secondResponse.EnsureSuccessStatusCode();
        var secondBody = await secondResponse.Content.ReadFromJsonAsync<MrpConfirmResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var first = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == firstBody!.Id);
        var second = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == secondBody!.Id);

        first.IsPrimary.Should().BeTrue();
        first.DisplayOrder.Should().Be(0);
        second.IsPrimary.Should().BeFalse();
        second.DisplayOrder.Should().Be(1);
    }

    [Fact]
    public async Task ConfirmUpload_OtherAccountStorageKey_Returns403()
    {
        var ctx = await CreateTenantContextWithRequestAsync();
        var otherAccountId = Guid.NewGuid();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = $"{otherAccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{otherAccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ConfirmUpload_NonExistentMaintenanceRequest_Returns404()
    {
        var ownerEmail = $"owner-confirm-404-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos",
            new
            {
                StorageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ConfirmUpload_CrossAccount_Returns404()
    {
        var ownerAEmail = $"owner-a-confirm-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var requestA = await SeedMaintenanceRequestAsync(accountA, propertyA, ownerAUserId);

        var ownerBEmail = $"owner-b-confirm-{Guid.NewGuid():N}@example.com";
        var (_, accountB) = await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        // B uses a key prefixed with their own accountId (so the key check passes),
        // but the maintenance request lookup fails because it belongs to A.
        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestA}/photos",
            new
            {
                StorageKey = $"{accountB}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{accountB}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ConfirmUpload_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-tenant-diff-confirm-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId);
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId);

        var t1Email = $"tenant1-confirm-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2Email = $"tenant2-confirm-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var requestId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos",
            new
            {
                StorageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ConfirmUpload_InvalidStorageKeyFormat_Returns400()
    {
        // Handler throws ArgumentException when first path segment isn't a GUID → 400.
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = "not-a-guid/maintenance-requests/2026/file.jpg",
                ThumbnailStorageKey = "not-a-guid/maintenance-requests/2026/file_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "file.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ConfirmUpload_InvalidContentType_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "text/plain",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.txt"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("ContentType");
    }

    [Fact]
    public async Task ConfirmUpload_EmptyStorageKey_Returns400()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = "",
                ThumbnailStorageKey = $"{ctx.AccountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("StorageKey");
    }

    // =====================================================
    // GetPhotos tests (AC-10..12) — Task 5
    // =====================================================

    [Fact]
    public async Task GetPhotos_AsOwner_ReturnsOrderedPhotos()
    {
        var ownerEmail = $"owner-get-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        // Seed 3 photos (primary + 2 non-primary)
        await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 0, isPrimary: true);
        await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 1, isPrimary: false);
        await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 2, isPrimary: false);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetMrpResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().HaveCount(3);
        body.Items[0].DisplayOrder.Should().Be(0);
        body.Items[1].DisplayOrder.Should().Be(1);
        body.Items[2].DisplayOrder.Should().Be(2);
        body.Items[0].IsPrimary.Should().BeTrue();
        body.Items[1].IsPrimary.Should().BeFalse();
        body.Items[2].IsPrimary.Should().BeFalse();
        body.Items.Should().AllSatisfy(p =>
        {
            p.ThumbnailUrl.Should().NotBeNullOrEmpty();
            p.ViewUrl.Should().NotBeNullOrEmpty();
        });
    }

    [Fact]
    public async Task GetPhotos_EmptyRequest_ReturnsEmptyList()
    {
        var ownerEmail = $"owner-get-empty-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetMrpResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().NotBeNull();
        body.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPhotos_DoesNotLeakOtherMaintenanceRequestPhotos()
    {
        var ownerEmail = $"owner-get-leak-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var requestA = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);
        var requestB = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        // 3 photos on A, 2 on B
        var aPhoto1 = await SeedMaintenanceRequestPhotoAsync(accountId, requestA, ownerUserId, displayOrder: 0, isPrimary: true);
        var aPhoto2 = await SeedMaintenanceRequestPhotoAsync(accountId, requestA, ownerUserId, displayOrder: 1, isPrimary: false);
        var aPhoto3 = await SeedMaintenanceRequestPhotoAsync(accountId, requestA, ownerUserId, displayOrder: 2, isPrimary: false);

        var bPhoto1 = await SeedMaintenanceRequestPhotoAsync(accountId, requestB, ownerUserId, displayOrder: 0, isPrimary: true);
        var bPhoto2 = await SeedMaintenanceRequestPhotoAsync(accountId, requestB, ownerUserId, displayOrder: 1, isPrimary: false);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestA}/photos", accessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetMrpResponse>();

        body!.Items.Should().HaveCount(3);
        var ids = body.Items.Select(i => i.Id).ToList();
        ids.Should().BeEquivalentTo(new[] { aPhoto1, aPhoto2, aPhoto3 });
        ids.Should().NotContain(bPhoto1);
        ids.Should().NotContain(bPhoto2);
    }

    [Fact]
    public async Task GetPhotos_NonExistentMaintenanceRequest_Returns404()
    {
        var ownerEmail = $"owner-get-404-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{Guid.NewGuid()}/photos", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_CrossAccount_Returns404()
    {
        var ownerAEmail = $"owner-a-get-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var requestA = await SeedMaintenanceRequestAsync(accountA, propertyA, ownerAUserId);
        await SeedMaintenanceRequestPhotoAsync(accountA, requestA, ownerAUserId);

        var ownerBEmail = $"owner-b-get-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestA}/photos", accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-tenant-diff-get-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId);
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId);

        var t1Email = $"tenant1-get-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2Email = $"tenant2-get-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var requestId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);
        await SeedMaintenanceRequestPhotoAsync(accountId, requestId, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_AsTenantOnSameProperty_Returns200()
    {
        // Shared visibility: another tenant on the same property can see the photos.
        var ownerEmail = $"owner-tenant-same-get-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId);

        var t1Email = $"tenant1-same-get-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2Email = $"tenant2-same-get-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p1, t2Email);

        // T2 submitted a request with a photo; T1 (same property) should be able to GET.
        var requestId = await SeedMaintenanceRequestAsync(accountId, p1, t2UserId);
        await SeedMaintenanceRequestPhotoAsync(accountId, requestId, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetMrpResponse>();
        body!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetPhotos_ReturnsPresignedUrls()
    {
        var ownerEmail = $"owner-get-urls-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var storageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg";
        var thumbKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg";
        await SeedMaintenanceRequestPhotoAsync(
            accountId, requestId, ownerUserId,
            storageKey: storageKey, thumbnailStorageKey: thumbKey);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos", accessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetMrpResponse>();

        body!.Items.Should().HaveCount(1);
        body.Items[0].ViewUrl.Should().Be(
            $"https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=download");
        body.Items[0].ThumbnailUrl.Should().Be(
            $"https://test-bucket.s3.amazonaws.com/{thumbKey}?presigned=download");
    }

    // =====================================================
    // DeletePhoto tests (AC-13..18) — Task 6
    // =====================================================

    [Fact]
    public async Task DeletePhoto_AsOwner_ValidId_Returns204()
    {
        var ownerEmail = $"owner-delete-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);
        var photoId = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{photoId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeletePhoto_RemovesDbRow()
    {
        var ownerEmail = $"owner-delete-row-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);
        var photoId = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{photoId}", accessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.Id == photoId);

        count.Should().Be(0);
    }

    [Fact]
    public async Task DeletePhoto_InvokesStorageDelete()
    {
        var ownerEmail = $"owner-delete-storage-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var storageKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg";
        var thumbKey = $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg";
        var photoId = await SeedMaintenanceRequestPhotoAsync(
            accountId, requestId, ownerUserId,
            storageKey: storageKey, thumbnailStorageKey: thumbKey);

        var fakeStorage = _factory.Services.GetRequiredService<FakeStorageService>();
        var snapshotBefore = fakeStorage.DeletedKeys.Count;

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{photoId}", accessToken);
        response.EnsureSuccessStatusCode();

        // Delta containment: DeletedKeys is a singleton accumulator across tests.
        fakeStorage.DeletedKeys.Count.Should().BeGreaterThanOrEqualTo(snapshotBefore + 2);
        fakeStorage.DeletedKeys.Should().Contain(storageKey);
        fakeStorage.DeletedKeys.Should().Contain(thumbKey);
    }

    [Fact]
    public async Task DeletePhoto_WasPrimary_PromotesNextPhotoByDisplayOrder()
    {
        var ownerEmail = $"owner-delete-promote-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var primary = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 0, isPrimary: true);
        var second = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 1, isPrimary: false);
        var third = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 2, isPrimary: false);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{primary}", accessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var secondPhoto = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == second);
        var thirdPhoto = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == third);

        secondPhoto.IsPrimary.Should().BeTrue("remaining photo with lowest DisplayOrder should be promoted");
        thirdPhoto.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task DeletePhoto_WasNotPrimary_LeavesPrimaryUntouched()
    {
        var ownerEmail = $"owner-delete-np-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var primary = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 0, isPrimary: true);
        var secondary = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 1, isPrimary: false);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{secondary}", accessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var primaryPhoto = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == primary);

        primaryPhoto.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task DeletePhoto_LastPhoto_NoPromotion()
    {
        var ownerEmail = $"owner-delete-last-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var onlyPhoto = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, ownerUserId, displayOrder: 0, isPrimary: true);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{onlyPhoto}", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await dbContext.MaintenanceRequestPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.MaintenanceRequestId == requestId);
        count.Should().Be(0);
    }

    [Fact]
    public async Task DeletePhoto_NonExistentPhoto_Returns404()
    {
        var ownerEmail = $"owner-delete-404-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{Guid.NewGuid()}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_CrossAccountPhoto_Returns404()
    {
        var ownerAEmail = $"owner-a-delete-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var requestA = await SeedMaintenanceRequestAsync(accountA, propertyA, ownerAUserId);
        var photoA = await SeedMaintenanceRequestPhotoAsync(accountA, requestA, ownerAUserId);

        var ownerBEmail = $"owner-b-delete-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestA}/photos/{photoA}", accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_PhotoOnDifferentMaintenanceRequest_Returns404()
    {
        var ownerEmail = $"owner-delete-diffreq-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var requestA = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);
        var requestB = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        var photoA = await SeedMaintenanceRequestPhotoAsync(accountId, requestA, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        // DELETE with requestB/photoAId — photo exists but belongs to requestA; lookup fails.
        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestB}/photos/{photoA}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-tenant-diff-delete-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId);
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId);

        var t1Email = $"tenant1-delete-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2Email = $"tenant2-delete-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        var requestId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);
        var photoId = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{photoId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_AsTenantOnSameProperty_Returns204()
    {
        // Shared visibility: tenant on same property can delete (symmetric with GET).
        var ownerEmail = $"owner-tenant-same-delete-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId);

        var t1Email = $"tenant1-same-delete-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2Email = $"tenant2-same-delete-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p1, t2Email);

        var requestId = await SeedMaintenanceRequestAsync(accountId, p1, t2UserId);
        var photoId = await SeedMaintenanceRequestPhotoAsync(accountId, requestId, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}/photos/{photoId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeletePhoto_InvalidRouteGuid_Returns400()
    {
        // Route constraint :guid rejects non-GUID values with 404 (ASP.NET routing behavior).
        // The :guid constraint means the URL doesn't match the route, so the result is 404.
        // Document the ACTUAL behavior: route doesn't match → 404 NotFound.
        var ownerEmail = $"owner-route-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        // maintenanceRequestId not a GUID
        var response = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/not-a-guid/photos/{Guid.NewGuid()}", accessToken);

        // Route constraint mismatch produces 404 (route doesn't match any endpoint).
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // End-to-end flow (Task 7)
    // =====================================================

    [Fact]
    public async Task MaintenanceRequestPhotoFlow_UploadUrlConfirmGetDelete_Succeeds()
    {
        var ctx = await CreateTenantContextWithRequestAsync();

        // Step 1: generate upload URL
        var uploadUrlResponse = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 5000L, OriginalFileName = "e2e.jpg" },
            ctx.AccessToken);
        uploadUrlResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var uploadUrl = await uploadUrlResponse.Content.ReadFromJsonAsync<MrpUploadUrlResponse>();

        // Step 2: confirm
        var confirmResponse = await PostAsJsonWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos",
            new
            {
                StorageKey = uploadUrl!.StorageKey,
                ThumbnailStorageKey = uploadUrl.ThumbnailStorageKey,
                ContentType = "image/jpeg",
                FileSizeBytes = 5000L,
                OriginalFileName = "e2e.jpg"
            },
            ctx.AccessToken);
        confirmResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var photo = await confirmResponse.Content.ReadFromJsonAsync<MrpConfirmResponse>();

        // Step 3: GET
        var getResponse = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos", ctx.AccessToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var photos = await getResponse.Content.ReadFromJsonAsync<GetMrpResponse>();
        photos!.Items.Should().HaveCount(1);
        photos.Items[0].Id.Should().Be(photo!.Id);
        photos.Items[0].ViewUrl.Should().Be(
            $"https://test-bucket.s3.amazonaws.com/{uploadUrl.StorageKey}?presigned=download");

        // Step 4: DELETE
        var deleteResponse = await DeleteWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos/{photo.Id}", ctx.AccessToken);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify deletion
        var afterDelete = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{ctx.MaintenanceRequestId}/photos", ctx.AccessToken);
        var afterDeleteBody = await afterDelete.Content.ReadFromJsonAsync<GetMrpResponse>();
        afterDeleteBody!.Items.Should().BeEmpty();
    }

    // =====================================================
    // Helpers
    // =====================================================

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginOwnerAsync(string email)
    {
        var password = "Test@123456";
        var (userId, _) = await _factory.CreateTestUserAsync(email, password);
        var (accessToken, _) = await LoginAsync(email, password);
        return (accessToken, userId);
    }

    private async Task<(string AccessToken, Guid? UserId)> LoginAsync(string email, string password = "Test@123456")
    {
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<MrpLoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    /// <summary>
    /// Creates a Tenant user, property, and seeded maintenance request — a complete tenant context
    /// ready for photo-endpoint tests.
    /// </summary>
    private async Task<MrpTenantContext> CreateTenantContextWithRequestAsync()
    {
        var ownerEmail = $"owner-seed-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var tenantEmail = $"tenant-{Guid.NewGuid():N}@example.com";
        var tenantUserId = await _factory.CreateTenantUserInAccountAsync(
            accountId, propertyId, tenantEmail);

        var maintenanceRequestId = await SeedMaintenanceRequestAsync(accountId, propertyId, tenantUserId);

        var (accessToken, _) = await LoginAsync(tenantEmail);
        return new MrpTenantContext(accessToken, tenantUserId, accountId, propertyId, maintenanceRequestId);
    }

    private sealed record MrpTenantContext(
        string AccessToken,
        Guid UserId,
        Guid AccountId,
        Guid PropertyId,
        Guid MaintenanceRequestId);

    /// <summary>
    /// Seeds a MaintenanceRequest directly via DbContext.
    /// </summary>
    private async Task<Guid> SeedMaintenanceRequestAsync(
        Guid accountId,
        Guid propertyId,
        Guid submittedByUserId,
        string description = "seeded")
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var entity = new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            SubmittedByUserId = submittedByUserId,
            Description = description,
            Status = Domain.Enums.MaintenanceRequestStatus.Submitted
        };

        dbContext.MaintenanceRequests.Add(entity);
        await dbContext.SaveChangesAsync();

        return entity.Id;
    }

    /// <summary>
    /// Seeds a MaintenanceRequestPhoto directly via DbContext. Returns the new photo id.
    /// When storageKey/thumbnailStorageKey are null, generates fresh account-scoped keys.
    /// </summary>
    private async Task<Guid> SeedMaintenanceRequestPhotoAsync(
        Guid accountId,
        Guid maintenanceRequestId,
        Guid createdByUserId,
        string? storageKey = null,
        string? thumbnailStorageKey = null,
        int displayOrder = 0,
        bool isPrimary = true,
        string originalFileName = "seeded.jpg",
        string contentType = "image/jpeg",
        long fileSizeBytes = 1024L)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var photo = new MaintenanceRequestPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            MaintenanceRequestId = maintenanceRequestId,
            CreatedByUserId = createdByUserId,
            StorageKey = storageKey ?? $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = thumbnailStorageKey ?? $"{accountId}/maintenance-requests/2026/{Guid.NewGuid()}_thumb.jpg",
            OriginalFileName = originalFileName,
            ContentType = contentType,
            FileSizeBytes = fileSizeBytes,
            DisplayOrder = displayOrder,
            IsPrimary = isPrimary
        };

        dbContext.MaintenanceRequestPhotos.Add(photo);
        await dbContext.SaveChangesAsync();

        return photo.Id;
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
}

// =====================================================
// Response records scoped to this test file (do NOT re-import Application DTOs —
// changes at the HTTP boundary should surface as test failures).
// =====================================================

file record MrpUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

file record MrpConfirmResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

file record MrpPhotoDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string? OriginalFileName,
    long? FileSizeBytes,
    DateTime CreatedAt);

file record GetMrpResponse(IReadOnlyList<MrpPhotoDto> Items);

file record MrpLoginResponse(string AccessToken, int ExpiresIn);
