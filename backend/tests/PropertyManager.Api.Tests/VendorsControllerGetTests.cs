using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for VendorsController GET endpoints (Story 21.6, AC #1, #2-#13):
///   GET /api/v1/vendors
///   GET /api/v1/vendors/{id}
///
/// Mirrors VendorsControllerCreateTests.cs / VendorsControllerDeleteTests.cs conventions:
/// IClassFixture, per-test unique emails, FluentAssertions, helpers colocated.
/// Reuses DTOs already declared in VendorsControllerCreateTests.cs (same assembly):
///   CreateVendorResponse, GetAllVendorsResponse, VendorDto, PhoneNumberDto, VendorTradeTagDto.
/// </summary>
public class VendorsControllerGetTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public VendorsControllerGetTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // Auth coverage (AC-1) — Task 2
    // =====================================================

    [Fact]
    public async Task GetAllVendors_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/vendors");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetVendor_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync($"/api/v1/vendors/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateVendor_WithoutAuth_Returns401()
    {
        var payload = new
        {
            FirstName = "X",
            LastName = "Y",
            Phones = Array.Empty<object>(),
            Emails = Array.Empty<string>(),
            TradeTagIds = Array.Empty<Guid>()
        };

        var response = await _client.PutAsJsonAsync($"/api/v1/vendors/{Guid.NewGuid()}", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // =====================================================
    // GET /api/v1/vendors — AC-2 to AC-8 — Task 3
    // =====================================================

    [Fact]
    public async Task GetAllVendors_AsOwner_ReturnsAccountScopedList_OrderedByLastNameThenFirstName()
    {
        // AC-2
        var ctx = await CreateOwnerContextAsync();

        await CreateVendorAsync(ctx.AccessToken, "Joe", null, "Smith");
        await CreateVendorAsync(ctx.AccessToken, "Mary", null, "Adams");
        await CreateVendorAsync(ctx.AccessToken, "Bob", null, "Adams");

        var response = await GetWithAuthAsync("/api/v1/vendors", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().HaveCount(3);
        body.TotalCount.Should().Be(3);

        // Order: Adams Bob → Adams Mary → Smith Joe
        body.Items[0].LastName.Should().Be("Adams");
        body.Items[0].FirstName.Should().Be("Bob");
        body.Items[1].LastName.Should().Be("Adams");
        body.Items[1].FirstName.Should().Be("Mary");
        body.Items[2].LastName.Should().Be("Smith");
        body.Items[2].FirstName.Should().Be("Joe");
    }

    [Fact]
    public async Task GetAllVendors_DoesNotLeakOtherAccountVendors()
    {
        // AC-3
        var ctxA = await CreateOwnerContextAsync();
        var ctxB = await CreateOwnerContextAsync();

        var aId1 = await CreateVendorAsync(ctxA.AccessToken, "A1", null, "Alpha");
        var aId2 = await CreateVendorAsync(ctxA.AccessToken, "A2", null, "Alpha");
        var aId3 = await CreateVendorAsync(ctxA.AccessToken, "A3", null, "Alpha");

        var bId1 = await CreateVendorAsync(ctxB.AccessToken, "B1", null, "Beta");
        var bId2 = await CreateVendorAsync(ctxB.AccessToken, "B2", null, "Beta");

        // Account A view
        var responseA = await GetWithAuthAsync("/api/v1/vendors", ctxA.AccessToken);
        var bodyA = await responseA.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        bodyA!.Items.Should().HaveCount(3);
        bodyA.Items.Select(v => v.Id).Should().BeEquivalentTo(new[] { aId1, aId2, aId3 });
        bodyA.Items.Select(v => v.Id).Should().NotContain(bId1);
        bodyA.Items.Select(v => v.Id).Should().NotContain(bId2);

        // Account B view
        var responseB = await GetWithAuthAsync("/api/v1/vendors", ctxB.AccessToken);
        var bodyB = await responseB.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        bodyB!.Items.Should().HaveCount(2);
        bodyB.Items.Select(v => v.Id).Should().BeEquivalentTo(new[] { bId1, bId2 });
        bodyB.Items.Select(v => v.Id).Should().NotContain(aId1);
    }

    [Fact]
    public async Task GetAllVendors_OmitsSoftDeletedVendors()
    {
        // AC-4
        var ctx = await CreateOwnerContextAsync();

        var keep1 = await CreateVendorAsync(ctx.AccessToken, "Keep1", null, "Vendor");
        var keep2 = await CreateVendorAsync(ctx.AccessToken, "Keep2", null, "Vendor");
        var deleted = await CreateVendorAsync(ctx.AccessToken, "Gone", null, "Vendor");

        // Soft-delete via direct DB update
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var vendor = await dbContext.Vendors.FirstAsync(v => v.Id == deleted);
            vendor.DeletedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
        }

        var response = await GetWithAuthAsync("/api/v1/vendors", ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        body!.Items.Should().HaveCount(2);
        body.TotalCount.Should().Be(2);
        body.Items.Select(v => v.Id).Should().BeEquivalentTo(new[] { keep1, keep2 });
        body.Items.Select(v => v.Id).Should().NotContain(deleted);
    }

    [Fact]
    public async Task GetAllVendors_EmptyAccount_ReturnsEmptyList()
    {
        // AC-5
        var ctx = await CreateOwnerContextAsync();

        var response = await GetWithAuthAsync("/api/v1/vendors", ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<GetAllVendorsResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().NotBeNull();
        body.Items.Should().BeEmpty();
        body.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllVendors_IncludesTradeTagsAndThumbnailUrl()
    {
        // AC-6
        var ctx = await CreateOwnerContextAsync();

        // Vendor 1 — has 2 trade tags + a primary photo with thumbnail
        var vendorWithTagsId = await CreateVendorAsync(ctx.AccessToken, "Tagged", null, "Vendor");
        // Vendor 2 — no tags, no primary photo
        var vendorNoTagsId = await CreateVendorAsync(ctx.AccessToken, "Plain", null, "Vendor");

        Guid tagPlumberId, tagHvacId;
        string thumbnailKey;

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            tagPlumberId = Guid.NewGuid();
            tagHvacId = Guid.NewGuid();

            dbContext.VendorTradeTags.AddRange(
                new VendorTradeTag
                {
                    Id = tagPlumberId,
                    AccountId = ctx.AccountId,
                    Name = "Plumber",
                    CreatedAt = DateTime.UtcNow
                },
                new VendorTradeTag
                {
                    Id = tagHvacId,
                    AccountId = ctx.AccountId,
                    Name = "HVAC",
                    CreatedAt = DateTime.UtcNow
                });

            dbContext.VendorTradeTagAssignments.AddRange(
                new VendorTradeTagAssignment { VendorId = vendorWithTagsId, TradeTagId = tagPlumberId },
                new VendorTradeTagAssignment { VendorId = vendorWithTagsId, TradeTagId = tagHvacId });

            thumbnailKey = $"{ctx.AccountId}/vendors/2026/{Guid.NewGuid()}_thumb.jpg";

            dbContext.VendorPhotos.Add(new VendorPhoto
            {
                Id = Guid.NewGuid(),
                AccountId = ctx.AccountId,
                VendorId = vendorWithTagsId,
                StorageKey = $"{ctx.AccountId}/vendors/2026/{Guid.NewGuid()}.jpg",
                ThumbnailStorageKey = thumbnailKey,
                OriginalFileName = "primary.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024,
                IsPrimary = true,
                DisplayOrder = 0,
                CreatedByUserId = ctx.UserId
            });

            await dbContext.SaveChangesAsync();
        }

        var response = await GetWithAuthAsync("/api/v1/vendors", ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Use a thumbnail-aware DTO — the existing VendorDto record (in CreateTests file)
        // doesn't expose PrimaryPhotoThumbnailUrl. System.Text.Json ignores the field
        // when reading into the existing record, so we use the local extended record here.
        var body = await response.Content.ReadFromJsonAsync<GetAllVendorsWithThumbnailResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().HaveCount(2);

        var tagged = body.Items.Single(v => v.Id == vendorWithTagsId);
        tagged.TradeTags.Should().HaveCount(2);
        tagged.TradeTags.Select(t => t.Name).Should().BeEquivalentTo(new[] { "Plumber", "HVAC" });
        tagged.PrimaryPhotoThumbnailUrl.Should().NotBeNullOrEmpty();
        tagged.PrimaryPhotoThumbnailUrl!.Should().Contain("?presigned=download");
        tagged.PrimaryPhotoThumbnailUrl.Should().Contain(thumbnailKey);

        var plain = body.Items.Single(v => v.Id == vendorNoTagsId);
        plain.TradeTags.Should().BeEmpty();
        plain.PrimaryPhotoThumbnailUrl.Should().BeNull();
    }

    [Fact]
    public async Task GetAllVendors_AsContributor_Returns403()
    {
        // AC-7
        var ctx = await CreateOwnerContextAsync();

        var contribEmail = $"contrib-vendors-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await GetWithAuthAsync("/api/v1/vendors", contribToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetAllVendors_AsTenant_Returns403()
    {
        // AC-8
        var ctx = await CreateOwnerContextAsync();

        var propertyId = await _factory.CreatePropertyInAccountAsync(ctx.AccountId);
        var tenantEmail = $"tenant-vendors-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, propertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await GetWithAuthAsync("/api/v1/vendors", tenantToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // =====================================================
    // GET /api/v1/vendors/{id} — AC-9 to AC-13 — Task 4
    // =====================================================

    [Fact]
    public async Task GetVendor_AsOwner_Returns200WithFullDetail()
    {
        // AC-9
        var ctx = await CreateOwnerContextAsync();

        var createPayload = new
        {
            FirstName = "Joe",
            MiddleName = "Allen",
            LastName = "Smith",
            Phones = new[] { new { Number = "555-1234", Label = "Cell" } },
            Emails = new[] { "joe@example.com" },
            TradeTagIds = Array.Empty<Guid>()
        };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/vendors", createPayload, ctx.AccessToken);
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<CreateVendorResponse>();
        var vendorId = created!.Id;

        // Seed a trade tag and assignment directly
        Guid tagId;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            tagId = Guid.NewGuid();
            dbContext.VendorTradeTags.Add(new VendorTradeTag
            {
                Id = tagId,
                AccountId = ctx.AccountId,
                Name = "Roofer",
                CreatedAt = DateTime.UtcNow
            });
            dbContext.VendorTradeTagAssignments.Add(new VendorTradeTagAssignment
            {
                VendorId = vendorId,
                TradeTagId = tagId
            });
            await dbContext.SaveChangesAsync();
        }

        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}", ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<TestVendorDetailDto>();
        body.Should().NotBeNull();
        body!.Id.Should().Be(vendorId);
        body.FirstName.Should().Be("Joe");
        body.MiddleName.Should().Be("Allen");
        body.LastName.Should().Be("Smith");
        body.FullName.Should().Be("Joe Allen Smith");
        body.Phones.Should().HaveCount(1);
        body.Phones[0].Number.Should().Be("555-1234");
        body.Phones[0].Label.Should().Be("Cell");
        body.Emails.Should().BeEquivalentTo(new[] { "joe@example.com" });
        body.TradeTags.Should().HaveCount(1);
        body.TradeTags[0].Id.Should().Be(tagId);
        body.TradeTags[0].Name.Should().Be("Roofer");
    }

    [Fact]
    public async Task GetVendor_CrossAccount_Returns404()
    {
        // AC-10
        var ctxA = await CreateOwnerContextAsync();
        var ctxB = await CreateOwnerContextAsync();

        var vendorId = await CreateVendorAsync(ctxA.AccessToken, "Cross", null, "Account");

        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}", ctxB.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetVendor_SoftDeleted_Returns404()
    {
        // AC-11
        var ctx = await CreateOwnerContextAsync();

        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Soft", null, "Deleted");

        // Soft-delete via API DELETE
        var deleteResponse = await DeleteWithAuthAsync($"/api/v1/vendors/{vendorId}", ctx.AccessToken);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}", ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetVendor_NonExistent_Returns404()
    {
        // AC-12
        var ctx = await CreateOwnerContextAsync();

        var response = await GetWithAuthAsync($"/api/v1/vendors/{Guid.NewGuid()}", ctx.AccessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetVendor_AsContributor_Returns403()
    {
        // AC-13
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Any", null, "Vendor");

        var contribEmail = $"contrib-vendors-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(ctx.AccountId, contribEmail, role: "Contributor");
        var (contribToken, _) = await LoginAsync(contribEmail);

        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}", contribToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetVendor_AsTenant_Returns403()
    {
        // AC-13
        var ctx = await CreateOwnerContextAsync();
        var vendorId = await CreateVendorAsync(ctx.AccessToken, "Any", null, "Vendor");

        var propertyId = await _factory.CreatePropertyInAccountAsync(ctx.AccountId);
        var tenantEmail = $"tenant-vendors-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(ctx.AccountId, propertyId, tenantEmail);
        var (tenantToken, _) = await LoginAsync(tenantEmail);

        var response = await GetWithAuthAsync($"/api/v1/vendors/{vendorId}", tenantToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // =====================================================
    // Helpers
    // =====================================================

    private async Task<OwnerContext> CreateOwnerContextAsync()
    {
        var email = $"owner-vendors-get-{Guid.NewGuid():N}@example.com";
        var (userId, accountId) = await _factory.CreateTestUserAsync(email);
        var (accessToken, _) = await LoginAsync(email);
        return new OwnerContext(accessToken, userId, accountId);
    }

    private async Task<(string AccessToken, Guid? UserId)> LoginAsync(string email, string password = "Test@123456")
    {
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    private async Task<Guid> CreateVendorAsync(string accessToken, string firstName, string? middleName, string lastName)
    {
        object request = middleName is null
            ? new { FirstName = firstName, LastName = lastName }
            : new { FirstName = firstName, MiddleName = middleName, LastName = lastName };

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

    private sealed record OwnerContext(string AccessToken, Guid UserId, Guid AccountId);
}

// =====================================================
// Test-local DTOs (deliberately separate from VendorsControllerCreateTests's
// VendorDto/GetAllVendorsResponse so changes to the wire shape surface here).
// =====================================================

/// <summary>
/// Wire-shape DTO for GET /api/v1/vendors/{id}. The test re-declares it intentionally:
/// the HTTP-contract on this endpoint is what we're testing, so re-importing the
/// Application's VendorDetailDto would mask shape regressions.
/// </summary>
public record TestVendorDetailDto(
    Guid Id,
    string FirstName,
    string? MiddleName,
    string LastName,
    string FullName,
    IReadOnlyList<PhoneNumberDto> Phones,
    IReadOnlyList<string> Emails,
    IReadOnlyList<VendorTradeTagDto> TradeTags
);

/// <summary>
/// Wire-shape DTO for GET /api/v1/vendors that includes PrimaryPhotoThumbnailUrl.
/// VendorsControllerCreateTests.cs declares an older VendorDto that omits the field;
/// re-declaring with the field here lets AC-6 read it without modifying the existing test record.
/// </summary>
public record VendorDtoWithThumbnail(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    IReadOnlyList<PhoneNumberDto> Phones,
    IReadOnlyList<string> Emails,
    IReadOnlyList<VendorTradeTagDto> TradeTags,
    string? PrimaryPhotoThumbnailUrl
);

public record GetAllVendorsWithThumbnailResponse(
    IReadOnlyList<VendorDtoWithThumbnail> Items,
    int TotalCount
);
