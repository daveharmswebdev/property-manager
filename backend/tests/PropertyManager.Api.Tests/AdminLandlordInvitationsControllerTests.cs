using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Authorization;
using PropertyManager.Infrastructure.Identity;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for AdminLandlordInvitationsController (Story 22.2).
/// Covers AC #1 (persistence shape), #2 (403 for non-PlatformAdmin),
/// #3 (401 unauthenticated), #4 (duplicate registered), #5 (duplicate pending),
/// #6 (landlord-flavored email only), #7 (validator behavior + extra field ignore),
/// #11 (stub deleted; this controller now satisfies the orphan check).
/// </summary>
public class AdminLandlordInvitationsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private const string Endpoint = "/api/v1/admin/landlord-invitations";

    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AdminLandlordInvitationsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // ===== Helpers =====

    private async Task<string> LoginAsync(string email, string password = "Test@123456")
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new { Email = email, Password = password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        return body!.AccessToken;
    }

    private async Task GrantPlatformAdminClaimAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(userId.ToString())
            ?? throw new InvalidOperationException($"User {userId} not found");
        var result = await userManager.AddClaimAsync(
            user, new Claim(PlatformClaims.PlatformAdmin, "true"));
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to grant PlatformAdmin claim: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }
    }

    private async Task<(Guid UserId, string Token)> CreatePlatformAdminAsync()
    {
        var email = $"admin-{Guid.NewGuid():N}@example.com";
        var (userId, _) = await _factory.CreateTestUserAsync(email);
        await GrantPlatformAdminClaimAsync(userId);
        var token = await LoginAsync(email);
        return (userId, token);
    }

    private async Task<HttpResponseMessage> PostAsync(object? body, string? token = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, Endpoint);
        if (token != null)
        {
            request.Headers.Add("Authorization", $"Bearer {token}");
        }
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }
        return await _client.SendAsync(request);
    }

    // ===== AC #1 — happy path =====

    [Fact]
    public async Task Create_AsPlatformAdmin_Returns201_PersistsInvitationWithNullAccountIdAndRoleOwner()
    {
        // AC: 22.2 #1
        var (adminUserId, token) = await CreatePlatformAdminAsync();
        var invitedEmail = $"new-{Guid.NewGuid():N}@example.com";

        var response = await PostAsync(new { Email = invitedEmail }, token);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<CreateLandlordInvitationResponse>();
        body.Should().NotBeNull();
        body!.InvitationId.Should().NotBe(Guid.Empty);
        body.Message.Should().Contain("successfully");

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var inv = await dbContext.Invitations.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == body.InvitationId);
        inv.Should().NotBeNull();
        inv!.AccountId.Should().BeNull();
        inv.Role.Should().Be("Owner");
        inv.PropertyId.Should().BeNull();
        inv.InvitedByUserId.Should().Be(adminUserId);
        inv.Email.Should().Be(invitedEmail.ToLowerInvariant());
        inv.UsedAt.Should().BeNull();
        inv.ExpiresAt.Should().BeAfter(DateTime.UtcNow.AddHours(23));
        inv.ExpiresAt.Should().BeBefore(DateTime.UtcNow.AddHours(25));
    }

    // ===== AC #6 — landlord email sent, not co-owner or tenant =====

    [Fact]
    public async Task Create_AsPlatformAdmin_SendsLandlordEmail_NotCoOwnerOrTenant()
    {
        // AC: 22.2 #6
        var (_, token) = await CreatePlatformAdminAsync();
        var invitedEmail = $"new-{Guid.NewGuid():N}@example.com";
        var lowered = invitedEmail.ToLowerInvariant();

        var fakeEmail = _factory.Services.GetRequiredService<FakeEmailService>();
        var coOwnerBefore = fakeEmail.SentInvitationEmails.Count(e => e.Email == lowered);
        var tenantBefore = fakeEmail.SentTenantInvitationEmails.Count(e => e.Email == lowered);

        var response = await PostAsync(new { Email = invitedEmail }, token);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        fakeEmail.SentLandlordInvitationEmails.Should().ContainSingle(e => e.Email == lowered);
        fakeEmail.SentInvitationEmails.Count(e => e.Email == lowered).Should().Be(coOwnerBefore);
        fakeEmail.SentTenantInvitationEmails.Count(e => e.Email == lowered).Should().Be(tenantBefore);
    }

    // ===== AC #2 — 403 for non-PlatformAdmin =====

    [Fact]
    public async Task Create_AsRegularOwner_Returns403()
    {
        // AC: 22.2 #2
        var email = $"owner-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(email, role: "Owner");
        var token = await LoginAsync(email);

        var response = await PostAsync(new { Email = $"newland-{Guid.NewGuid():N}@example.com" }, token);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Create_AsContributor_Returns403()
    {
        // AC: 22.2 #2
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, role: "Owner");
        await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, role: "Contributor");
        var token = await LoginAsync(contributorEmail);

        var response = await PostAsync(new { Email = $"newland-{Guid.NewGuid():N}@example.com" }, token);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Create_AsTenant_Returns403()
    {
        // AC: 22.2 #2
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var tenantEmail = $"tenant-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, role: "Owner");
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        await _factory.CreateTenantUserInAccountAsync(accountId, propertyId, tenantEmail);
        var token = await LoginAsync(tenantEmail);

        var response = await PostAsync(new { Email = $"newland-{Guid.NewGuid():N}@example.com" }, token);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ===== AC #3 — 401 unauthenticated =====

    [Fact]
    public async Task Create_AsUnauthenticated_Returns401()
    {
        // AC: 22.2 #3
        var response = await PostAsync(new { Email = $"newland-{Guid.NewGuid():N}@example.com" }, token: null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ===== AC #7 — validation =====

    [Fact]
    public async Task Create_WithMissingEmail_Returns400()
    {
        // AC: 22.2 #7
        var (_, token) = await CreatePlatformAdminAsync();

        var response = await PostAsync(new { }, token);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Email");
        body.Should().Contain("required");
    }

    [Fact]
    public async Task Create_WithMalformedEmail_Returns400()
    {
        // AC: 22.2 #7
        var (_, token) = await CreatePlatformAdminAsync();

        var response = await PostAsync(new { Email = "not-an-email" }, token);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Invalid email format");
    }

    // ===== AC #4 — duplicate registered =====

    [Fact]
    public async Task Create_WithDuplicateRegisteredEmail_Returns400()
    {
        // AC: 22.2 #4
        var (_, token) = await CreatePlatformAdminAsync();
        var existingEmail = $"existing-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(existingEmail);

        var response = await PostAsync(new { Email = existingEmail }, token);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("already registered");

        // Verify no invitation row was created for this email
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var exists = await dbContext.Invitations.AnyAsync(i => i.Email == existingEmail.ToLowerInvariant());
        exists.Should().BeFalse();
    }

    // ===== AC #5 — duplicate pending =====

    [Fact]
    public async Task Create_WithPendingInvitationForSameEmail_Returns400()
    {
        // AC: 22.2 #5
        var (_, token) = await CreatePlatformAdminAsync();
        var invitedEmail = $"pending-{Guid.NewGuid():N}@example.com";

        var first = await PostAsync(new { Email = invitedEmail }, token);
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await PostAsync(new { Email = invitedEmail }, token);

        second.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await second.Content.ReadAsStringAsync();
        body.Should().Contain("pending invitation");
    }

    // ===== AC #7 — extra fields ignored =====

    [Fact]
    public async Task Create_WithExtraFieldsInPayload_IgnoresThem()
    {
        // AC: 22.2 #7
        var (_, token) = await CreatePlatformAdminAsync();
        var invitedEmail = $"extras-{Guid.NewGuid():N}@example.com";

        var response = await PostAsync(new
        {
            Email = invitedEmail,
            Role = "Tenant",
            AccountId = Guid.NewGuid(),
            PropertyId = Guid.NewGuid()
        }, token);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<CreateLandlordInvitationResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var inv = await dbContext.Invitations.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == body!.InvitationId);
        inv.Should().NotBeNull();
        inv!.Role.Should().Be("Owner");
        inv.AccountId.Should().BeNull();
        inv.PropertyId.Should().BeNull();
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresIn);
    private sealed record CreateLandlordInvitationResponse(Guid InvitationId, string Message);
}
