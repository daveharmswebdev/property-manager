using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Authorization;
using PropertyManager.Infrastructure.Identity;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for Story 22.1 — the "CanInviteLandlords" policy and the platformAdmin
/// JWT-claim round trip. Hits the Dev-only stub endpoint
/// (<c>GET /api/v1/test/platform-admin-only</c>) registered by
/// <c>PlatformAdminStubController</c>.
/// </summary>
public class PlatformAdminPolicyTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private const string StubEndpoint = "/api/v1/test/platform-admin-only";

    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public PlatformAdminPolicyTests(PropertyManagerWebApplicationFactory factory)
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

    private static HttpRequestMessage Get(string url, string? token = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (token != null)
        {
            request.Headers.Add("Authorization", $"Bearer {token}");
        }
        return request;
    }

    // ===== AC #6 — Policy enforcement =====

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsPlatformAdmin_Returns200()
    {
        // Arrange — Owner who also carries the platformAdmin claim
        var email = $"admin-{Guid.NewGuid():N}@example.com";
        var (userId, _) = await _factory.CreateTestUserAsync(email);
        await GrantPlatformAdminClaimAsync(userId);
        var token = await LoginAsync(email);

        // Act
        var response = await _client.SendAsync(Get(StubEndpoint, token));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsRegularOwner_Returns403()
    {
        // Arrange — plain Owner, no claim
        var email = $"owner-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(email, role: "Owner");
        var token = await LoginAsync(email);

        // Act
        var response = await _client.SendAsync(Get(StubEndpoint, token));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsContributor_Returns403()
    {
        // Arrange — Contributor in a fresh account; no PlatformAdmin claim
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, role: "Owner");
        await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, role: "Contributor");
        var token = await LoginAsync(contributorEmail);

        // Act
        var response = await _client.SendAsync(Get(StubEndpoint, token));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsTenant_Returns403()
    {
        // Arrange — Tenant in a fresh account; no PlatformAdmin claim
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var tenantEmail = $"tenant-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, role: "Owner");
        var propertyId = await _factory.CreatePropertyInAccountAsync(accountId);
        await _factory.CreateTenantUserInAccountAsync(accountId, propertyId, tenantEmail);
        var token = await LoginAsync(tenantEmail);

        // Act
        var response = await _client.SendAsync(Get(StubEndpoint, token));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsUnauthenticated_Returns401()
    {
        // Act — no Authorization header
        var response = await _client.SendAsync(Get(StubEndpoint, token: null));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ===== AC #3 — JWT contains platformAdmin claim on login =====

    [Fact]
    public async Task Login_AsPlatformAdmin_JwtIncludesPlatformAdminClaim()
    {
        // Arrange — equivalent of seeded claude@claude.com behavior
        var email = $"admin-{Guid.NewGuid():N}@example.com";
        var (userId, _) = await _factory.CreateTestUserAsync(email);
        await GrantPlatformAdminClaimAsync(userId);

        // Act
        var token = await LoginAsync(email);

        // Assert — decode token and confirm claim is present with value "true"
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().Contain(c =>
            c.Type == PlatformClaims.PlatformAdmin && c.Value == "true");
    }

    [Fact]
    public async Task Login_AsRegularOwner_JwtOmitsPlatformAdminClaim()
    {
        // Arrange — regular Owner, no claim
        var email = $"owner-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(email, role: "Owner");

        // Act
        var token = await LoginAsync(email);

        // Assert
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        jwt.Claims.Should().NotContain(c => c.Type == PlatformClaims.PlatformAdmin);
    }

    // ===== AC #7 — PlatformAdmin does NOT break existing per-account flows =====

    [Fact]
    public async Task PlatformAdmin_CanStillAccess_OwnAccountInvitationsEndpoint_Returns201()
    {
        // Arrange — Owner + PlatformAdmin invites a co-owner to their OWN account
        var email = $"admin-{Guid.NewGuid():N}@example.com";
        var (userId, _) = await _factory.CreateTestUserAsync(email, role: "Owner");
        await GrantPlatformAdminClaimAsync(userId);
        var token = await LoginAsync(email);

        var inviteRequest = new
        {
            Email = $"invitee-{Guid.NewGuid():N}@example.com",
            Role = "Contributor"
        };
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/invitations")
        {
            Content = JsonContent.Create(inviteRequest)
        };
        request.Headers.Add("Authorization", $"Bearer {token}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert — per-account invitation flow still works for PlatformAdmin
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresIn);
}
