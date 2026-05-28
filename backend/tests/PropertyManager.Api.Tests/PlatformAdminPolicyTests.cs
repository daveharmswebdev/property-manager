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
/// Integration tests for the "CanInviteLandlords" policy and the platformAdmin
/// JWT-claim round trip (Story 22.1). After Story 22.2 these now target the real
/// production endpoint <c>POST /api/v1/admin/landlord-invitations</c> instead of
/// the Story 22.1 stub (which has been deleted per AC #11).
/// </summary>
public class PlatformAdminPolicyTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private const string TargetEndpoint = "/api/v1/admin/landlord-invitations";

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

    private static HttpRequestMessage Post(string url, object? body, string? token = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        if (token != null)
        {
            request.Headers.Add("Authorization", $"Bearer {token}");
        }
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }
        return request;
    }

    // ===== AC #6 — Policy enforcement =====

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsPlatformAdmin_Returns201()
    {
        // Arrange — Owner who also carries the platformAdmin claim
        var email = $"admin-{Guid.NewGuid():N}@example.com";
        var (userId, _) = await _factory.CreateTestUserAsync(email);
        await GrantPlatformAdminClaimAsync(userId);
        var token = await LoginAsync(email);

        var invited = $"new-{Guid.NewGuid():N}@example.com";

        // Act
        var response = await _client.SendAsync(Post(TargetEndpoint, new { Email = invited }, token));

        // Assert — Story 22.2 endpoint returns 201 Created on the happy path.
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsRegularOwner_Returns403()
    {
        // Arrange — plain Owner, no claim
        var email = $"owner-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(email, role: "Owner");
        var token = await LoginAsync(email);

        // Act — body irrelevant; policy fires before model binding
        var response = await _client.SendAsync(Post(TargetEndpoint, new { }, token));

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
        var response = await _client.SendAsync(Post(TargetEndpoint, new { }, token));

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
        var response = await _client.SendAsync(Post(TargetEndpoint, new { }, token));

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CanInviteLandlordsPolicy_AsUnauthenticated_Returns401()
    {
        // Act — no Authorization header
        var response = await _client.SendAsync(Post(TargetEndpoint, new { }, token: null));

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
