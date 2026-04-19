using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for MaintenanceRequestsController covering all four endpoints:
///   POST   /api/v1/maintenance-requests
///   GET    /api/v1/maintenance-requests
///   GET    /api/v1/maintenance-requests/{id}
///   GET    /api/v1/maintenance-requests/tenant-property
///
/// Exercises the real HTTP + DI + EF Core + JWT auth + global query filter + permission policy stack.
/// See Story 21.1 for AC mapping. Tests assert the SHIPPED controller/handler behavior — any
/// assertion mismatch is a test bug, not a handler bug (test-only story, do not change handlers).
/// </summary>
public class MaintenanceRequestsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public MaintenanceRequestsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/maintenance-requests — Task 3 (AC #1–#5)
    // =====================================================

    [Fact]
    public async Task CreateMaintenanceRequest_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/maintenance-requests",
            new { description = "No auth" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateMaintenanceRequest_AsTenant_ValidBody_Returns201WithIdAndLocation()
    {
        var ctx = await CreateTenantContextAsync();

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/maintenance-requests",
            new { description = "Leaky faucet" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.ToString().Should().Contain("/api/v1/maintenance-requests/");

        var body = await response.Content.ReadFromJsonAsync<CreateMaintenanceRequestResponse>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateMaintenanceRequest_AsTenant_Persists_WithCorrectFields()
    {
        var ctx = await CreateTenantContextAsync();
        var description = "  Broken heater  "; // whitespace to confirm handler trims

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/maintenance-requests",
            new { description },
            ctx.AccessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<CreateMaintenanceRequestResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var persisted = await dbContext.MaintenanceRequests
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(mr => mr.Id == body!.Id);

        persisted.Should().NotBeNull();
        persisted!.Status.Should().Be(MaintenanceRequestStatus.Submitted);
        persisted.PropertyId.Should().Be(ctx.PropertyId);
        persisted.SubmittedByUserId.Should().Be(ctx.UserId);
        persisted.AccountId.Should().Be(ctx.AccountId);
        persisted.Description.Should().Be("Broken heater");
    }

    [Fact]
    public async Task CreateMaintenanceRequest_AsContributor_Returns403()
    {
        // Owner seeds the account; Contributor is added to same account.
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, role: "Contributor");

        var (accessToken, _) = await LoginAsync(contributorEmail);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/maintenance-requests",
            new { description = "Contributor try" },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateMaintenanceRequest_EmptyDescription_Returns400()
    {
        var ctx = await CreateTenantContextAsync();

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/maintenance-requests",
            new { description = "" },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Description");
    }

    [Fact]
    public async Task CreateMaintenanceRequest_DescriptionTooLong_Returns400()
    {
        var ctx = await CreateTenantContextAsync();
        var longDescription = new string('x', 5001);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/maintenance-requests",
            new { description = longDescription },
            ctx.AccessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Description");
        content.Should().Contain("5000");
    }

    [Fact]
    public async Task CreateMaintenanceRequest_NullBody_Returns400()
    {
        var ctx = await CreateTenantContextAsync();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/maintenance-requests");
        request.Headers.Add("Authorization", $"Bearer {ctx.AccessToken}");
        request.Content = new StringContent("null", System.Text.Encoding.UTF8, "application/json");
        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateMaintenanceRequest_CallerWithoutAssignedProperty_Returns400()
    {
        // Owner has MaintenanceRequests.Create but no assigned PropertyId on the JWT.
        // Handler throws BusinessRuleException → global middleware maps to 400 BadRequest.
        var email = $"owner-no-prop-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(email);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/maintenance-requests",
            new { description = "Owner posting" },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("assigned property");
    }

    // =====================================================
    // GET /api/v1/maintenance-requests — Task 4 (AC #6, #7, #8, #16)
    // =====================================================

    [Fact]
    public async Task GetMaintenanceRequests_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/maintenance-requests");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMaintenanceRequests_AsOwner_ReturnsAccountScopedList()
    {
        // Account A: Owner + 2 properties + 3 requests across them
        var ownerAEmail = $"owner-a-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var a_p1 = await _factory.CreatePropertyInAccountAsync(accountA, name: "A-P1");
        var a_p2 = await _factory.CreatePropertyInAccountAsync(accountA, name: "A-P2");

        var a_r1 = await SeedMaintenanceRequestAsync(accountA, a_p1, ownerAUserId);
        var a_r2 = await SeedMaintenanceRequestAsync(accountA, a_p1, ownerAUserId);
        var a_r3 = await SeedMaintenanceRequestAsync(accountA, a_p2, ownerAUserId);

        // Account B: Owner + property + 2 requests
        var ownerBEmail = $"owner-b-{Guid.NewGuid():N}@example.com";
        var (ownerBUserId, accountB) = await _factory.CreateTestUserAsync(ownerBEmail);
        var b_p1 = await _factory.CreatePropertyInAccountAsync(accountB, name: "B-P1");
        await SeedMaintenanceRequestAsync(accountB, b_p1, ownerBUserId);
        await SeedMaintenanceRequestAsync(accountB, b_p1, ownerBUserId);

        var (accessToken, _) = await LoginAsync(ownerAEmail);

        var response = await GetWithAuthAsync("/api/v1/maintenance-requests", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();
        content.Should().NotBeNull();
        content!.TotalCount.Should().Be(3);
        content.Items.Should().HaveCount(3);
        content.Items.Select(i => i.Id).Should().BeEquivalentTo(new[] { a_r1, a_r2, a_r3 });
    }

    [Fact]
    public async Task GetMaintenanceRequests_CrossAccount_DoesNotLeak()
    {
        var ownerAEmail = $"owner-a-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var a_p1 = await _factory.CreatePropertyInAccountAsync(accountA);
        await SeedMaintenanceRequestAsync(accountA, a_p1, ownerAUserId);

        var ownerBEmail = $"owner-b-{Guid.NewGuid():N}@example.com";
        var (ownerBUserId, accountB) = await _factory.CreateTestUserAsync(ownerBEmail);
        var b_p1 = await _factory.CreatePropertyInAccountAsync(accountB);
        var b_r1 = await SeedMaintenanceRequestAsync(accountB, b_p1, ownerBUserId);
        var b_r2 = await SeedMaintenanceRequestAsync(accountB, b_p1, ownerBUserId);

        var (accessToken, _) = await LoginAsync(ownerAEmail);

        var response = await GetWithAuthAsync("/api/v1/maintenance-requests", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        content!.Items.Select(i => i.Id).Should().NotContain(b_r1);
        content.Items.Select(i => i.Id).Should().NotContain(b_r2);
    }

    [Fact]
    public async Task GetMaintenanceRequests_OrderedByCreatedAtDesc()
    {
        var ownerEmail = $"owner-order-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        // Seed three requests with explicit, spread CreatedAt values.
        var r1 = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            createdAt: DateTime.UtcNow.AddMinutes(-30));
        var r2 = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            createdAt: DateTime.UtcNow.AddMinutes(-20));
        var r3 = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            createdAt: DateTime.UtcNow.AddMinutes(-10));

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync("/api/v1/maintenance-requests", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        content!.Items.Should().HaveCount(3);
        content.Items[0].Id.Should().Be(r3);
        content.Items[1].Id.Should().Be(r2);
        content.Items[2].Id.Should().Be(r1);
        content.Items[0].CreatedAt.Should().BeOnOrAfter(content.Items[1].CreatedAt);
        content.Items[1].CreatedAt.Should().BeOnOrAfter(content.Items[2].CreatedAt);
    }

    [Fact]
    public async Task GetMaintenanceRequests_AsTenant_ReturnsPropertyScopedRequests_SharedVisibility()
    {
        // One account with P1 (Tenant-1 + Tenant-2) and P2 (Tenant-3).
        var ownerEmail = $"owner-tenant-share-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P2");

        var t1Email = $"tenant1-{Guid.NewGuid():N}@example.com";
        var t2Email = $"tenant2-{Guid.NewGuid():N}@example.com";
        var t3Email = $"tenant3-{Guid.NewGuid():N}@example.com";

        var t1UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p1, t2Email);
        var t3UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t3Email);

        // 3 requests on P1 (from T1, T2, and Owner) + 1 request on P2 (from T3)
        var p1_r_t1 = await SeedMaintenanceRequestAsync(accountId, p1, t1UserId);
        var p1_r_t2 = await SeedMaintenanceRequestAsync(accountId, p1, t2UserId);
        var p1_r_owner = await SeedMaintenanceRequestAsync(accountId, p1, ownerUserId);
        var p2_r_t3 = await SeedMaintenanceRequestAsync(accountId, p2, t3UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await GetWithAuthAsync("/api/v1/maintenance-requests", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        content!.TotalCount.Should().Be(3);
        var ids = content.Items.Select(i => i.Id).ToList();
        ids.Should().Contain(p1_r_t1);
        ids.Should().Contain(p1_r_t2); // shared property visibility (Story 20.3 AC #5)
        ids.Should().Contain(p1_r_owner);
        ids.Should().NotContain(p2_r_t3);
    }

    // =====================================================
    // GET /api/v1/maintenance-requests — filters & pagination (Task 5, AC #9–#11)
    // =====================================================

    [Fact]
    public async Task GetMaintenanceRequests_StatusFilter_CaseInsensitive_ReturnsMatching()
    {
        var ownerEmail = $"owner-status-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.Submitted);
        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.InProgress);
        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.Resolved);
        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.Dismissed);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        // Case-insensitive: "submitted" should match Submitted
        var submittedResponse = await GetWithAuthAsync(
            "/api/v1/maintenance-requests?status=submitted", accessToken);
        var submittedContent = await submittedResponse.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();
        submittedContent!.TotalCount.Should().Be(1);
        submittedContent.Items.Should().OnlyContain(i => i.Status == "Submitted");

        // "InProgress" uses PascalCase (Enum.TryParse ignoreCase accepts it either way)
        var inProgressResponse = await GetWithAuthAsync(
            "/api/v1/maintenance-requests?status=InProgress", accessToken);
        var inProgressContent = await inProgressResponse.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();
        inProgressContent!.TotalCount.Should().Be(1);
        inProgressContent.Items.Should().OnlyContain(i => i.Status == "InProgress");
    }

    [Fact]
    public async Task GetMaintenanceRequests_StatusFilter_InvalidValue_ReturnsUnfiltered()
    {
        var ownerEmail = $"owner-invalid-status-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.Submitted);
        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.InProgress);
        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.Resolved);
        await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            status: MaintenanceRequestStatus.Dismissed);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            "/api/v1/maintenance-requests?status=notARealStatus", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        // Handler uses Enum.TryParse and silently ignores invalid values — total is unfiltered
        content!.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task GetMaintenanceRequests_PropertyIdFilter_ReturnsMatching()
    {
        var ownerEmail = $"owner-pid-filter-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P2");

        await SeedMaintenanceRequestAsync(accountId, p1, ownerUserId);
        await SeedMaintenanceRequestAsync(accountId, p1, ownerUserId);
        await SeedMaintenanceRequestAsync(accountId, p2, ownerUserId);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests?propertyId={p1}", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        content!.TotalCount.Should().Be(2);
        content.Items.Should().OnlyContain(i => i.PropertyId == p1);
    }

    [Fact]
    public async Task GetMaintenanceRequests_Pagination_Page2PageSize10()
    {
        var ownerEmail = $"owner-page-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        for (var i = 0; i < 25; i++)
        {
            await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);
        }

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            "/api/v1/maintenance-requests?page=2&pageSize=10", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        content!.Items.Should().HaveCount(10);
        content.Page.Should().Be(2);
        content.PageSize.Should().Be(10);
        content.TotalCount.Should().Be(25);
        content.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task GetMaintenanceRequests_EmptyAccount_ReturnsEmptyList()
    {
        var ownerEmail = $"owner-empty-{Guid.NewGuid():N}@example.com";
        var (_, _) = await _factory.CreateTestUserAsync(ownerEmail);

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync("/api/v1/maintenance-requests", accessToken);
        var content = await response.Content.ReadFromJsonAsync<GetMaintenanceRequestsResponseDto>();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        content!.TotalCount.Should().Be(0);
        content.Items.Should().BeEmpty();
    }

    // =====================================================
    // GET /api/v1/maintenance-requests/{id} — Task 6 (AC #12–#14, #16)
    // =====================================================

    [Fact]
    public async Task GetMaintenanceRequestById_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync($"/api/v1/maintenance-requests/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMaintenanceRequestById_AsOwner_Returns200WithFullDto()
    {
        var ownerEmail = $"owner-byid-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(
            accountId, name: "Maple Cottage",
            street: "42 Maple St", city: "Dallas", state: "TX", zipCode: "75201");
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId,
            description: "Specific test description");

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<MaintenanceRequestDetailDto>();
        dto.Should().NotBeNull();
        dto!.Id.Should().Be(requestId);
        dto.PropertyId.Should().Be(propertyId);
        dto.PropertyName.Should().Be("Maple Cottage");
        dto.PropertyAddress.Should().Be("42 Maple St, Dallas, TX 75201");
        dto.Description.Should().Be("Specific test description");
        dto.Status.Should().Be("Submitted");
        dto.SubmittedByUserId.Should().Be(ownerUserId);
        dto.Photos.Should().NotBeNull();
        dto.Photos!.Should().BeEmpty();
    }

    [Fact]
    public async Task GetMaintenanceRequestById_CrossAccount_Returns404()
    {
        var ownerAEmail = $"owner-a-byid-{Guid.NewGuid():N}@example.com";
        var (ownerAUserId, accountA) = await _factory.CreateTestUserAsync(ownerAEmail);
        var propertyA = await _factory.CreatePropertyInAccountAsync(accountA);
        var requestId = await SeedMaintenanceRequestAsync(accountA, propertyA, ownerAUserId);

        var ownerBEmail = $"owner-b-byid-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerBEmail);

        var (accessToken, _) = await LoginAsync(ownerBEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetMaintenanceRequestById_SoftDeleted_Returns404()
    {
        var ownerEmail = $"owner-softdel-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        var requestId = await SeedMaintenanceRequestAsync(accountId, propertyId, ownerUserId);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var entity = await dbContext.MaintenanceRequests.FirstAsync(mr => mr.Id == requestId);
            entity.DeletedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
        }

        var (accessToken, _) = await LoginAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetMaintenanceRequestById_AsTenantOnDifferentProperty_Returns404()
    {
        var ownerEmail = $"owner-tenant-diff-{Guid.NewGuid():N}@example.com";
        var (ownerUserId, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P1");
        var p2 = await _factory.CreatePropertyInAccountAsync(accountId, name: "P2");

        var t1Email = $"tenant1-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant2-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p2, t2Email);

        // Request is on P2; Tenant-1 (on P1) tries to access.
        var requestId = await SeedMaintenanceRequestAsync(accountId, p2, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetMaintenanceRequestById_AsTenantOnSameProperty_Returns200()
    {
        var ownerEmail = $"owner-tenant-same-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var p1 = await _factory.CreatePropertyInAccountAsync(accountId);

        var t1Email = $"tenant1-same-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, p1, t1Email);

        var t2Email = $"tenant2-same-{Guid.NewGuid():N}@example.com";
        var t2UserId = await _factory.CreateTenantUserInAccountAsync(accountId, p1, t2Email);

        var requestId = await SeedMaintenanceRequestAsync(accountId, p1, t2UserId);

        var (accessToken, _) = await LoginAsync(t1Email);

        var response = await GetWithAuthAsync(
            $"/api/v1/maintenance-requests/{requestId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<MaintenanceRequestDetailDto>();
        dto!.Id.Should().Be(requestId);
        dto.SubmittedByUserId.Should().Be(t2UserId);
    }

    // =====================================================
    // GET /api/v1/maintenance-requests/tenant-property — Task 7 (AC #15, #16)
    // =====================================================

    [Fact]
    public async Task GetTenantProperty_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/maintenance-requests/tenant-property");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetTenantProperty_AsTenant_ReturnsAssignedProperty()
    {
        var ownerEmail = $"owner-tp-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);
        var propertyId = await _factory.CreatePropertyInAccountAsync(
            accountId,
            name: "Tenant Cottage",
            street: "7 Elm Ln", city: "Houston", state: "TX", zipCode: "77002");

        var tenantEmail = $"tenant-tp-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTenantUserInAccountAsync(accountId, propertyId, tenantEmail);

        var (accessToken, _) = await LoginAsync(tenantEmail);

        var response = await GetWithAuthAsync(
            "/api/v1/maintenance-requests/tenant-property", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<TenantPropertyResponseDto>();
        dto.Should().NotBeNull();
        dto!.Id.Should().Be(propertyId);
        dto.Name.Should().Be("Tenant Cottage");
        dto.Street.Should().Be("7 Elm Ln");
        dto.City.Should().Be("Houston");
        dto.State.Should().Be("TX");
        dto.ZipCode.Should().Be("77002");
    }

    [Fact]
    public async Task GetTenantProperty_AsOwner_Returns400()
    {
        // GetTenantPropertyQueryHandler throws BusinessRuleException when role != "Tenant".
        // Global exception middleware maps BusinessRuleException → 400 BadRequest.
        var ownerEmail = $"owner-tp-reject-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginOwnerAsync(ownerEmail);

        var response = await GetWithAuthAsync(
            "/api/v1/maintenance-requests/tenant-property", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Tenant");
    }

    // =====================================================
    // Helper methods
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

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<MrLoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    private async Task<TenantContext> CreateTenantContextAsync()
    {
        var ownerEmail = $"owner-seed-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);

        var tenantEmail = $"tenant-{Guid.NewGuid():N}@example.com";
        var tenantUserId = await _factory.CreateTenantUserInAccountAsync(
            accountId, propertyId, tenantEmail);

        var (accessToken, _) = await LoginAsync(tenantEmail);
        return new TenantContext(accessToken, tenantUserId, accountId, propertyId);
    }

    private sealed record TenantContext(string AccessToken, Guid UserId, Guid AccountId, Guid PropertyId);

    /// <summary>
    /// Seeds a MaintenanceRequest directly via DbContext. If a createdAt value is provided,
    /// it overrides the SaveChanges audit interceptor by running a follow-up update
    /// (the interceptor updates UpdatedAt on Modified but leaves CreatedAt alone).
    /// </summary>
    private async Task<Guid> SeedMaintenanceRequestAsync(
        Guid accountId,
        Guid propertyId,
        Guid submittedByUserId,
        string description = "seeded",
        MaintenanceRequestStatus status = MaintenanceRequestStatus.Submitted,
        DateTime? createdAt = null)
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
            Status = status
        };

        dbContext.MaintenanceRequests.Add(entity);
        await dbContext.SaveChangesAsync();

        if (createdAt.HasValue)
        {
            entity.CreatedAt = createdAt.Value;
            await dbContext.SaveChangesAsync();
        }

        return entity.Id;
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

// =====================================================
// Response records scoped to this test file (do NOT re-import Application DTOs —
// changes at the HTTP boundary should surface as test failures).
// =====================================================

file record CreateMaintenanceRequestResponse(Guid Id);

file record MaintenanceRequestItemDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    string PropertyAddress,
    string Description,
    string Status,
    string? DismissalReason,
    Guid SubmittedByUserId,
    string? SubmittedByUserName,
    Guid? WorkOrderId,
    DateTime CreatedAt,
    DateTime UpdatedAt);

file record GetMaintenanceRequestsResponseDto(
    IReadOnlyList<MaintenanceRequestItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);

file record MaintenanceRequestPhotoResponseDto(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl,
    bool IsPrimary,
    int DisplayOrder,
    string? OriginalFileName,
    long FileSizeBytes,
    DateTime CreatedAt);

file record MaintenanceRequestDetailDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    string PropertyAddress,
    string Description,
    string Status,
    string? DismissalReason,
    Guid SubmittedByUserId,
    string? SubmittedByUserName,
    Guid? WorkOrderId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<MaintenanceRequestPhotoResponseDto>? Photos);

file record TenantPropertyResponseDto(
    Guid Id,
    string Name,
    string Street,
    string City,
    string State,
    string ZipCode);

file record MrLoginResponse(string AccessToken, int ExpiresIn);
