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
/// Integration tests for WorkOrderPhotosController covering all six endpoints:
///   POST   /api/v1/work-orders/{id}/photos/upload-url
///   POST   /api/v1/work-orders/{id}/photos                    (ConfirmUpload)
///   GET    /api/v1/work-orders/{id}/photos
///   DELETE /api/v1/work-orders/{id}/photos/{photoId}
///   PUT    /api/v1/work-orders/{id}/photos/{photoId}/primary
///   PUT    /api/v1/work-orders/{id}/photos/reorder
///
/// Exercises the real HTTP + DI + EF Core + JWT auth + FakeStorageService stack.
/// Mirrors MaintenanceRequestPhotosControllerTests (Story 21.2, PR #373) patterns.
/// Tests assert SHIPPED behavior — including the no-promotion-on-delete divergence
/// from MaintenanceRequestPhotos / PropertyPhotos. See Story 21.5 AC-16.
/// </summary>
public class WorkOrderPhotosControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public WorkOrderPhotosControllerTests(PropertyManagerWebApplicationFactory factory)
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
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ConfirmUpload_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos",
            new
            {
                StorageKey = $"{Guid.NewGuid()}/work-orders/2026/x.jpg",
                ThumbnailStorageKey = $"{Guid.NewGuid()}/work-orders/2026/x_thumb.jpg",
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
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeletePhoto_WithoutAuth_Returns401()
    {
        var response = await _client.DeleteAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SetPrimaryPhoto_WithoutAuth_Returns401()
    {
        var response = await _client.PutAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/{Guid.NewGuid()}/primary",
            null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ReorderPhotos_WithoutAuth_Returns401()
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/reorder",
            new { PhotoIds = new List<Guid> { Guid.NewGuid() } });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // =====================================================
    // GenerateUploadUrl tests (AC-2..6) — Task 3
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_AsOwner_ValidBody_Returns200WithPresignedUrl()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "leak.jpg" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<WoUploadUrlResponse>();
        body.Should().NotBeNull();
        body!.UploadUrl.Should().NotBeNullOrEmpty();
        body.StorageKey.Should().NotBeNullOrEmpty();
        body.StorageKey.Should().StartWith(ctx.AccountId.ToString());
        body.ThumbnailStorageKey.Should().NotBeNullOrEmpty();
        body.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        body.UploadUrl.Should().Be(
            $"https://test-bucket.s3.amazonaws.com/{body.StorageKey}?presigned=true");
    }

    [Fact]
    public async Task GenerateUploadUrl_DoesNotCreatePhotoRow()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "test.jpg" },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.WorkOrderId == ctx.WorkOrderId);

        count.Should().Be(0);
    }

    [Fact]
    public async Task GenerateUploadUrl_NonExistentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-up-404-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_CrossAccount_Returns404()
    {
        // Account A has the work order
        var ownerAEmail = $"owner-a-wo-up-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var workOrderA = await SeedWorkOrderAsync(accountA, propertyA, ownerAUserId);

        // Account B's Owner tries to upload to A's work order
        var ownerBEmail = $"owner-b-wo-up-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateUploadUrl_InvalidContentType_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "text/plain", FileSizeBytes = 1024L, OriginalFileName = "x.txt" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("ContentType");
    }

    [Fact]
    public async Task GenerateUploadUrl_FileSizeExceedsMax_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
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
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var responseZero = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 0L, OriginalFileName = "x.jpg" },
            ctx.AccessToken);
        responseZero.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var responseNegative = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = -100L, OriginalFileName = "x.jpg" },
            ctx.AccessToken);
        responseNegative.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GenerateUploadUrl_EmptyOriginalFileName_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("OriginalFileName");
    }

    [Fact]
    public async Task GenerateUploadUrl_FileNameOver255Chars_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var longName = new string('x', 256);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = longName },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("OriginalFileName");
    }

    // =====================================================
    // ConfirmUpload tests (AC-7..10) — Task 4
    // =====================================================

    [Fact]
    public async Task ConfirmUpload_AsOwner_ValidRequest_Returns201WithIdAndUrls()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var storageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg";

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
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
        var body = await response.Content.ReadFromJsonAsync<WoConfirmResponse>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
        body.ViewUrl.Should().NotBeNullOrEmpty();
        // Location header references the new photo (note: shipped controller does NOT include "api/" prefix in Location header)
        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.OriginalString
            .Should().Be($"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{body.Id}");
    }

    [Fact]
    public async Task ConfirmUpload_PersistsPhotoRow_WithCorrectFields()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var storageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg";
        var thumbnailKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg";

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
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
        var body = await response.Content.ReadFromJsonAsync<WoConfirmResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == body!.Id);

        photo.Should().NotBeNull();
        photo!.AccountId.Should().Be(ctx.AccountId);
        photo.WorkOrderId.Should().Be(ctx.WorkOrderId);
        photo.CreatedByUserId.Should().Be(ctx.UserId);
        photo.OriginalFileName.Should().Be("leak.jpg");
        photo.ContentType.Should().Be("image/jpeg");
        photo.FileSizeBytes.Should().Be(4096L);
        photo.DisplayOrder.Should().Be(0);
        photo.IsPrimary.Should().BeTrue();
        photo.StorageKey.Should().Be(storageKey);
    }

    [Fact]
    public async Task ConfirmUpload_FirstPhoto_SetsPrimaryTrue_DisplayOrder0()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "first.jpg"
            },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<WoConfirmResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .FirstAsync(p => p.Id == body!.Id);

        photo.IsPrimary.Should().BeTrue();
        photo.DisplayOrder.Should().Be(0);
    }

    [Fact]
    public async Task ConfirmUpload_SecondPhoto_SetsPrimaryFalse_DisplayOrder1()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        // Seed first photo directly via DbContext (so we control its IsPrimary/DisplayOrder)
        var firstPhotoId = await SeedWorkOrderPhotoAsync(
            ctx.AccountId, ctx.WorkOrderId, ctx.UserId,
            displayOrder: 0, isPrimary: true);

        // Now ConfirmUpload a second photo
        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 2048L,
                OriginalFileName = "second.jpg"
            },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<WoConfirmResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var first = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == firstPhotoId);
        var second = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == body!.Id);

        first.IsPrimary.Should().BeTrue();
        first.DisplayOrder.Should().Be(0);
        second.IsPrimary.Should().BeFalse();
        second.DisplayOrder.Should().Be(1);
    }

    [Fact]
    public async Task ConfirmUpload_OtherAccountStorageKey_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var otherAccountId = Guid.NewGuid();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{otherAccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{otherAccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ConfirmUpload_NonExistentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-confirm-404-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos",
            new
            {
                StorageKey = $"{accountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{accountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
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
        var ownerAEmail = $"owner-a-wo-confirm-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var workOrderA = await SeedWorkOrderAsync(accountA, propertyA, ownerAUserId);

        var ownerBEmail = $"owner-b-wo-confirm-{Guid.NewGuid():N}@example.com";
        var (_, accountB) = await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        // B uses a key prefixed with their own accountId (key check passes),
        // but the work order lookup fails because it belongs to A.
        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos",
            new
            {
                StorageKey = $"{accountB}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{accountB}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ConfirmUpload_InvalidStorageKeyFormat_Returns400()
    {
        // Handler throws ArgumentException when first path segment isn't a GUID → 400.
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = "not-a-guid/work-orders/2026/file.jpg",
                ThumbnailStorageKey = "not-a-guid/work-orders/2026/file_thumb.jpg",
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
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
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
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = "",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("StorageKey");
    }

    [Fact]
    public async Task ConfirmUpload_EmptyThumbnailStorageKey_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = "",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("ThumbnailStorageKey");
    }

    [Fact]
    public async Task ConfirmUpload_FileSizeExceedsMax_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = PhotoValidation.MaxFileSizeBytes + 1,
                OriginalFileName = "big.jpg"
            },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("FileSizeBytes");
    }

    // =====================================================
    // GetPhotos tests (AC-11..14) — Task 5
    // =====================================================

    [Fact]
    public async Task GetPhotos_AsOwner_ReturnsOrderedPhotos()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetWoPhotosResponse>();
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
            p.PhotoUrl.Should().NotBeNullOrEmpty();
        });
    }

    [Fact]
    public async Task GetPhotos_EmptyWorkOrder_ReturnsEmptyList()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetWoPhotosResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().NotBeNull();
        body.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPhotos_DoesNotLeakOtherWorkOrderPhotos()
    {
        var ownerEmail = $"owner-wo-get-leak-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var workOrderA = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);
        var workOrderB = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);

        var aPhoto1 = await SeedWorkOrderPhotoAsync(accountId, workOrderA, ownerUserId, displayOrder: 0, isPrimary: true);
        var aPhoto2 = await SeedWorkOrderPhotoAsync(accountId, workOrderA, ownerUserId, displayOrder: 1, isPrimary: false);
        var aPhoto3 = await SeedWorkOrderPhotoAsync(accountId, workOrderA, ownerUserId, displayOrder: 2, isPrimary: false);

        var bPhoto1 = await SeedWorkOrderPhotoAsync(accountId, workOrderB, ownerUserId, displayOrder: 0, isPrimary: true);
        var bPhoto2 = await SeedWorkOrderPhotoAsync(accountId, workOrderB, ownerUserId, displayOrder: 1, isPrimary: false);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos", accessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetWoPhotosResponse>();

        body!.Items.Should().HaveCount(3);
        var ids = body.Items.Select(i => i.Id).ToList();
        ids.Should().BeEquivalentTo(new[] { aPhoto1, aPhoto2, aPhoto3 });
        ids.Should().NotContain(bPhoto1);
        ids.Should().NotContain(bPhoto2);
    }

    [Fact]
    public async Task GetPhotos_NonExistentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-get-404-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_CrossAccount_Returns404()
    {
        var ownerAEmail = $"owner-a-wo-get-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var workOrderA = await SeedWorkOrderAsync(accountA, propertyA, ownerAUserId);
        await SeedWorkOrderPhotoAsync(accountA, workOrderA, ownerAUserId);

        var ownerBEmail = $"owner-b-wo-get-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos", accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPhotos_ReturnsPresignedUrls()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var storageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg";
        var thumbKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg";
        await SeedWorkOrderPhotoAsync(
            ctx.AccountId, ctx.WorkOrderId, ctx.UserId,
            storageKey: storageKey, thumbnailStorageKey: thumbKey);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", ctx.AccessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<GetWoPhotosResponse>();

        body!.Items.Should().HaveCount(1);
        body.Items[0].PhotoUrl.Should().Be(
            $"https://test-bucket.s3.amazonaws.com/{storageKey}?presigned=download");
        body.Items[0].ThumbnailUrl.Should().Be(
            $"https://test-bucket.s3.amazonaws.com/{thumbKey}?presigned=download");
    }

    // =====================================================
    // DeletePhoto tests (AC-15..18) — Task 6
    // =====================================================

    [Fact]
    public async Task DeletePhoto_AsOwner_ValidId_Returns204()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var photoId = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeletePhoto_RemovesDbRow()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var photoId = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}", ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.Id == photoId);

        count.Should().Be(0);
    }

    [Fact]
    public async Task DeletePhoto_InvokesStorageDelete()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var storageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg";
        var thumbKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg";
        var photoId = await SeedWorkOrderPhotoAsync(
            ctx.AccountId, ctx.WorkOrderId, ctx.UserId,
            storageKey: storageKey, thumbnailStorageKey: thumbKey);

        var fakeStorage = _factory.Services.GetRequiredService<FakeStorageService>();
        var snapshotBefore = fakeStorage.DeletedKeys.Count;

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}", ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        // Delta containment: DeletedKeys is a singleton accumulator across tests.
        fakeStorage.DeletedKeys.Count.Should().BeGreaterThanOrEqualTo(snapshotBefore + 2);
        fakeStorage.DeletedKeys.Should().Contain(storageKey);
        fakeStorage.DeletedKeys.Should().Contain(thumbKey);
    }

    [Fact]
    public async Task DeletePhoto_WasPrimary_DoesNotPromoteOthers()
    {
        // Documents the SHIPPED no-promotion behavior of DeleteWorkOrderPhotoHandler.
        // This DIVERGES from MaintenanceRequestPhotos and PropertyPhotos. See AC-16.
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var primary = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        var second = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        var third = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{primary}", ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var secondPhoto = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == second);
        var thirdPhoto = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == third);

        secondPhoto.IsPrimary.Should().BeFalse("WorkOrderPhoto delete handler does NOT auto-promote a new primary");
        thirdPhoto.IsPrimary.Should().BeFalse("WorkOrderPhoto delete handler does NOT auto-promote a new primary");

        // Sanity: no remaining photo should be primary.
        var anyPrimary = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .AnyAsync(p => p.WorkOrderId == ctx.WorkOrderId && p.IsPrimary);
        anyPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task DeletePhoto_WasNotPrimary_LeavesPrimaryUntouched()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var primary = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        var secondary = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{secondary}", ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var primaryPhoto = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters().FirstAsync(p => p.Id == primary);

        primaryPhoto.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task DeletePhoto_LastPhoto_NoErrorAndNoPhotosLeft()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var onlyPhoto = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{onlyPhoto}", ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.WorkOrderId == ctx.WorkOrderId);
        count.Should().Be(0);
    }

    [Fact]
    public async Task DeletePhoto_NonExistentPhoto_Returns404()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{Guid.NewGuid()}", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_CrossAccountPhoto_Returns404()
    {
        var ownerAEmail = $"owner-a-wo-del-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var workOrderA = await SeedWorkOrderAsync(accountA, propertyA, ownerAUserId);
        var photoA = await SeedWorkOrderPhotoAsync(accountA, workOrderA, ownerAUserId);

        var ownerBEmail = $"owner-b-wo-del-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos/{photoA}", accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_PhotoOnDifferentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-del-diff-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var workOrderA = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);
        var workOrderB = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);
        var photoA = await SeedWorkOrderPhotoAsync(accountId, workOrderA, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        // DELETE with workOrderB/photoAId — photo exists but belongs to workOrderA.
        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{workOrderB}/photos/{photoA}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletePhoto_NonExistentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-del-no-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/{Guid.NewGuid()}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // SetPrimaryPhoto tests (AC-19..21) — Task 7
    // =====================================================

    [Fact]
    public async Task SetPrimaryPhoto_PromotesNewPhoto_AndDemotesOldPrimary()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        var p2 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        var p3 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{p3}/primary", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var photo1 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p1);
        var photo2 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p2);
        var photo3 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p3);

        photo1.IsPrimary.Should().BeFalse();
        photo2.IsPrimary.Should().BeFalse();
        photo3.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task SetPrimaryPhoto_ExactlyOnePrimary_Invariant()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        var p3 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{p3}/primary", ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var primaryCount = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.WorkOrderId == ctx.WorkOrderId && p.IsPrimary);
        primaryCount.Should().Be(1);
    }

    [Fact]
    public async Task SetPrimaryPhoto_AlreadyPrimary_NoOp_Returns204()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{p1}/primary", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var photo = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p1);
        photo.IsPrimary.Should().BeTrue();

        var totalPhotos = await dbContext.WorkOrderPhotos
            .IgnoreQueryFilters()
            .CountAsync(p => p.WorkOrderId == ctx.WorkOrderId);
        totalPhotos.Should().Be(1);
    }

    [Fact]
    public async Task SetPrimaryPhoto_CrossAccountPhoto_Returns404()
    {
        var ownerAEmail = $"owner-a-wo-prim-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var workOrderA = await SeedWorkOrderAsync(accountA, propertyA, ownerAUserId);
        var photoA = await SeedWorkOrderPhotoAsync(accountA, workOrderA, ownerAUserId, isPrimary: false);

        var ownerBEmail = $"owner-b-wo-prim-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos/{photoA}/primary", accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetPrimaryPhoto_NonExistentPhoto_Returns404()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{Guid.NewGuid()}/primary", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetPrimaryPhoto_PhotoOnDifferentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-prim-diff-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var workOrderA = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);
        var workOrderB = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);
        var photoA = await SeedWorkOrderPhotoAsync(accountId, workOrderA, ownerUserId, isPrimary: false);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        // PUT primary with workOrderB/photoAId — photo exists but belongs to A.
        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{workOrderB}/photos/{photoA}/primary", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // ReorderPhotos tests (AC-22..24) — Task 8
    // =====================================================

    [Fact]
    public async Task ReorderPhotos_ValidOrder_Returns204_AndUpdatesDisplayOrder()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        var p2 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        var p3 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        // New order: p3, p1, p2
        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { p3, p1, p2 } },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var photo1 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p1);
        var photo2 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p2);
        var photo3 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p3);

        photo3.DisplayOrder.Should().Be(0);
        photo1.DisplayOrder.Should().Be(1);
        photo2.DisplayOrder.Should().Be(2);
    }

    [Fact]
    public async Task ReorderPhotos_DoesNotChangeIsPrimary()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        var p2 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        var p3 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { p3, p1, p2 } },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var photo1 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p1);
        var photo2 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p2);
        var photo3 = await dbContext.WorkOrderPhotos.IgnoreQueryFilters().FirstAsync(p => p.Id == p3);

        photo1.IsPrimary.Should().BeTrue("reorder is orthogonal to primary flag");
        photo2.IsPrimary.Should().BeFalse();
        photo3.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task ReorderPhotos_EmptyPhotoIds_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid>() },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReorderPhotos_DuplicateIds_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { p1, p1 } },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReorderPhotos_NullPhotoIds_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = (List<Guid>?)null },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReorderPhotos_PartialPhotoSet_Returns400()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);
        var p2 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 1, isPrimary: false);
        await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 2, isPrimary: false);

        // Only 2 of the 3 photos — handler throws ValidationException → 400
        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { p1, p2 } },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReorderPhotos_PhotoIdNotOnWorkOrder_Returns404()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var p1 = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId, displayOrder: 0, isPrimary: true);

        // Include a guid that doesn't belong to this work order; handler throws NotFoundException → 404
        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { p1, Guid.NewGuid() } },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ReorderPhotos_CrossAccount_Returns404()
    {
        var ownerAEmail = $"owner-a-wo-reorder-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var workOrderA = await SeedWorkOrderAsync(accountA, propertyA, ownerAUserId);

        var ownerBEmail = $"owner-b-wo-reorder-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);
        var (accessTokenB, _) = await LoginAsync(ownerBEmail);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{workOrderA}/photos/reorder",
            new { PhotoIds = new List<Guid> { Guid.NewGuid() } },
            accessTokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ReorderPhotos_NonExistentWorkOrder_Returns404()
    {
        var ownerEmail = $"owner-wo-reorder-no-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{Guid.NewGuid()}/photos/reorder",
            new { PhotoIds = new List<Guid> { Guid.NewGuid() } },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // Role-based policy tests (AC-25) — Task 9
    // =====================================================

    [Fact]
    public async Task GenerateUploadUrl_AsTenant_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var tenantEmail = $"tenant-wo-up-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, ctx.PropertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetPhotos_AsTenant_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var tenantEmail = $"tenant-wo-get-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, ctx.PropertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ConfirmUpload_AsTenant_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var tenantEmail = $"tenant-wo-confirm-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, ctx.PropertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeletePhoto_AsTenant_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var photoId = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId);

        var tenantEmail = $"tenant-wo-del-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, ctx.PropertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}", tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SetPrimaryPhoto_AsTenant_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var photoId = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId);

        var tenantEmail = $"tenant-wo-prim-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, ctx.PropertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}/primary", tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ReorderPhotos_AsTenant_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var tenantEmail = $"tenant-wo-reorder-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, ctx.PropertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { Guid.NewGuid() } },
            tenantToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetPhotos_AsContributor_Returns200()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var contribEmail = $"contrib-wo-get-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", contribToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetWoPhotosResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().NotBeNull();
    }

    [Fact]
    public async Task GenerateUploadUrl_AsContributor_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var contribEmail = $"contrib-wo-up-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 1024L, OriginalFileName = "x.jpg" },
            contribToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ConfirmUpload_AsContributor_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var contribEmail = $"contrib-wo-confirm-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = $"{ctx.AccountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024L,
                OriginalFileName = "x.jpg"
            },
            contribToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeletePhoto_AsContributor_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var photoId = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId);

        var contribEmail = $"contrib-wo-del-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}", contribToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SetPrimaryPhoto_AsContributor_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();
        var photoId = await SeedWorkOrderPhotoAsync(ctx.AccountId, ctx.WorkOrderId, ctx.UserId);

        var contribEmail = $"contrib-wo-prim-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photoId}/primary", contribToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ReorderPhotos_AsContributor_Returns403()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        var contribEmail = $"contrib-wo-reorder-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { Guid.NewGuid() } },
            contribToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // =====================================================
    // End-to-end flow (AC-26) — Task 10
    // =====================================================

    [Fact]
    public async Task WorkOrderPhotoFlow_FullCycle_Succeeds()
    {
        var ctx = await CreateOwnerContextWithWorkOrderAsync();

        // Step 1: GenerateUploadUrl (twice)
        var upload1Resp = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 5000L, OriginalFileName = "first.jpg" },
            ctx.AccessToken);
        upload1Resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var upload1 = await upload1Resp.Content.ReadFromJsonAsync<WoUploadUrlResponse>();

        var upload2Resp = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/upload-url",
            new { ContentType = "image/jpeg", FileSizeBytes = 6000L, OriginalFileName = "second.jpg" },
            ctx.AccessToken);
        upload2Resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var upload2 = await upload2Resp.Content.ReadFromJsonAsync<WoUploadUrlResponse>();

        // Step 2: ConfirmUpload (twice)
        var confirm1Resp = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = upload1!.StorageKey,
                ThumbnailStorageKey = upload1.ThumbnailStorageKey,
                ContentType = "image/jpeg",
                FileSizeBytes = 5000L,
                OriginalFileName = "first.jpg"
            },
            ctx.AccessToken);
        confirm1Resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var photo1 = await confirm1Resp.Content.ReadFromJsonAsync<WoConfirmResponse>();

        var confirm2Resp = await PostAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos",
            new
            {
                StorageKey = upload2!.StorageKey,
                ThumbnailStorageKey = upload2.ThumbnailStorageKey,
                ContentType = "image/jpeg",
                FileSizeBytes = 6000L,
                OriginalFileName = "second.jpg"
            },
            ctx.AccessToken);
        confirm2Resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var photo2 = await confirm2Resp.Content.ReadFromJsonAsync<WoConfirmResponse>();

        // Step 3: GetPhotos
        var getResp = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", ctx.AccessToken);
        getResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var photos = await getResp.Content.ReadFromJsonAsync<GetWoPhotosResponse>();
        photos!.Items.Should().HaveCount(2);
        photos.Items.Single(p => p.Id == photo1!.Id).IsPrimary.Should().BeTrue();
        photos.Items.Single(p => p.Id == photo2!.Id).IsPrimary.Should().BeFalse();

        // Step 4: SetPrimaryPhoto — promote photo2
        var setPrimaryResp = await PutWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photo2!.Id}/primary", ctx.AccessToken);
        setPrimaryResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 5: ReorderPhotos — swap order (photo2 first, photo1 second)
        var reorderResp = await PutAsJsonWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/reorder",
            new { PhotoIds = new List<Guid> { photo2.Id, photo1!.Id } },
            ctx.AccessToken);
        reorderResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 6: DeletePhoto — delete photo1
        var deleteResp = await DeleteWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos/{photo1.Id}", ctx.AccessToken);
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 7: Final GetPhotos — verify photo2 remains as the only photo, primary, DisplayOrder == 0
        var finalResp = await GetWithAuthAsync(
            $"/api/v1/work-orders/{ctx.WorkOrderId}/photos", ctx.AccessToken);
        finalResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var final = await finalResp.Content.ReadFromJsonAsync<GetWoPhotosResponse>();
        final!.Items.Should().HaveCount(1);
        final.Items[0].Id.Should().Be(photo2.Id);
        final.Items[0].IsPrimary.Should().BeTrue();
        final.Items[0].DisplayOrder.Should().Be(0);
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
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<WoLoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    /// <summary>
    /// Creates an Owner user, property, and work order — a complete owner context
    /// ready for work-order photo endpoint tests.
    /// </summary>
    private async Task<OwnerContext> CreateOwnerContextWithWorkOrderAsync()
    {
        var ownerEmail = $"owner-wo-seed-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var workOrderId = await SeedWorkOrderAsync(accountId, propertyId, ownerUserId);
        var (accessToken, _) = await LoginAsync(ownerEmail);
        return new OwnerContext(accessToken, ownerUserId, accountId, propertyId, workOrderId);
    }

    private sealed record OwnerContext(
        string AccessToken,
        Guid UserId,
        Guid AccountId,
        Guid PropertyId,
        Guid WorkOrderId);

    /// <summary>
    /// Seeds a WorkOrder directly via DbContext.
    /// </summary>
    private async Task<Guid> SeedWorkOrderAsync(
        Guid accountId,
        Guid propertyId,
        Guid createdByUserId,
        string description = "seeded WO")
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var entity = new WorkOrder
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            CreatedByUserId = createdByUserId,
            Description = description,
            Status = Domain.Enums.WorkOrderStatus.Reported
        };

        dbContext.WorkOrders.Add(entity);
        await dbContext.SaveChangesAsync();

        return entity.Id;
    }

    /// <summary>
    /// Seeds a WorkOrderPhoto directly via DbContext. Returns the new photo id.
    /// When storageKey/thumbnailStorageKey are null, generates fresh account-scoped keys.
    /// </summary>
    private async Task<Guid> SeedWorkOrderPhotoAsync(
        Guid accountId,
        Guid workOrderId,
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

        var photo = new WorkOrderPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            WorkOrderId = workOrderId,
            CreatedByUserId = createdByUserId,
            StorageKey = storageKey ?? $"{accountId}/work-orders/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = thumbnailStorageKey ?? $"{accountId}/work-orders/2026/{Guid.NewGuid()}_thumb.jpg",
            OriginalFileName = originalFileName,
            ContentType = contentType,
            FileSizeBytes = fileSizeBytes,
            DisplayOrder = displayOrder,
            IsPrimary = isPrimary
        };

        dbContext.WorkOrderPhotos.Add(photo);
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
// Response records scoped to this test file (do NOT re-import Application DTOs —
// changes at the HTTP boundary should surface as test failures).
// Wo* prefix avoids name collisions with Mrp* (Story 21.2) and PropertyPhoto* records.
// =====================================================

file record WoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

file record WoConfirmResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

file record WoPhotoDto(
    Guid Id,
    Guid WorkOrderId,
    string? OriginalFileName,
    string? ContentType,
    long? FileSizeBytes,
    int DisplayOrder,
    bool IsPrimary,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    string? PhotoUrl,
    string? ThumbnailUrl);

file record GetWoPhotosResponse(IReadOnlyList<WoPhotoDto> Items);

file record WoLoginResponse(string AccessToken, int ExpiresIn);
