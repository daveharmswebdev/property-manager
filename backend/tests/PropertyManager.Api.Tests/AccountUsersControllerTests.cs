using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for AccountUsersController (AC #1, #2, #3, #4, #5).
/// </summary>
public class AccountUsersControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AccountUsersControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // ==================== HELPER METHODS ====================

    private async Task<(string OwnerToken, string ContributorToken, Guid AccountId, Guid OwnerId, Guid ContributorId)>
        CreateOwnerAndContributorInSameAccountAsync()
    {
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";

        var (ownerId, accountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var contributorId = await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, "Test@123456", "Contributor");

        var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");
        var contributorToken = await GetAccessTokenAsync(contributorEmail, "Test@123456");

        return (ownerToken, contributorToken, accountId, ownerId, contributorId);
    }

    private async Task<string> GetAccessTokenAsync(string email, string password)
    {
        var loginRequest = new { Email = email, Password = password };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<LoginResponse>();
        return content!.AccessToken;
    }

    private async Task<HttpResponseMessage> SendWithAuthAsync(HttpMethod method, string url, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }
        return await _client.SendAsync(request);
    }

    // ==================== GET ACCOUNT USERS TESTS (AC #1, #5) ====================

    // Task 8.2: Owner gets 200 with user list
    [Fact]
    public async Task GetAccountUsers_AsOwner_ReturnsUserList()
    {
        // Arrange
        var (ownerToken, _, _, _, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/account/users", ownerToken);

        // Assert — AC #1: Owner receives list of users
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetAccountUsersResponse>();
        content!.Items.Should().HaveCountGreaterThanOrEqualTo(2);
        content.Items.Should().Contain(u => u.Role == "Owner");
        content.Items.Should().Contain(u => u.Role == "Contributor");
    }

    // Task 8.3: Contributor blocked
    [Fact]
    public async Task GetAccountUsers_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _, _, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/account/users", contributorToken);

        // Assert — AC #5: Contributor blocked from account user endpoints
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== UPDATE USER ROLE TESTS (AC #2, #3, #5) ====================

    // Task 8.4: Owner can change role
    [Fact]
    public async Task UpdateUserRole_AsOwner_Returns204()
    {
        // Arrange
        var (ownerToken, _, _, _, contributorId) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { Role = "Owner" };

        // Act — promote Contributor to Owner
        var response = await SendWithAuthAsync(HttpMethod.Put, $"/api/v1/account/users/{contributorId}/role", ownerToken, request);

        // Assert — AC #2: Role updated successfully
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // Task 8.5: Contributor blocked
    [Fact]
    public async Task UpdateUserRole_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _, ownerId, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { Role = "Contributor" };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Put, $"/api/v1/account/users/{ownerId}/role", contributorToken, request);

        // Assert — AC #5: Contributor blocked
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Task 8.6: Cannot demote last owner
    [Fact]
    public async Task UpdateUserRole_LastOwner_Returns400()
    {
        // Arrange — create account with single owner
        var ownerEmail = $"solo-owner-{Guid.NewGuid():N}@example.com";
        var (ownerId, accountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");
        var request = new { Role = "Contributor" };

        // Act — try to demote the last owner
        var response = await SendWithAuthAsync(HttpMethod.Put, $"/api/v1/account/users/{ownerId}/role", ownerToken, request);

        // Assert — AC #3: Cannot remove last owner
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== REMOVE USER TESTS (AC #4, #3, #5) ====================

    // Task 8.7: Owner can remove user
    [Fact]
    public async Task RemoveUser_AsOwner_Returns204()
    {
        // Arrange
        var (ownerToken, _, _, _, contributorId) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Delete, $"/api/v1/account/users/{contributorId}", ownerToken);

        // Assert — AC #4: User removed
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // Task 8.8: Contributor blocked
    [Fact]
    public async Task RemoveUser_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _, ownerId, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Delete, $"/api/v1/account/users/{ownerId}", contributorToken);

        // Assert — AC #5: Contributor blocked
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Task 8.9: Cannot remove last owner
    [Fact]
    public async Task RemoveUser_LastOwner_Returns400()
    {
        // Arrange — create account with single owner
        var ownerEmail = $"solo-owner-rm-{Guid.NewGuid():N}@example.com";
        var (ownerId, _) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Act — try to remove the last owner
        var response = await SendWithAuthAsync(HttpMethod.Delete, $"/api/v1/account/users/{ownerId}", ownerToken);

        // Assert — AC #3: Cannot remove last owner
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // Task 8.10: Removed user cannot login
    [Fact]
    public async Task RemoveUser_RemovedUserCannotLogin()
    {
        // Arrange
        var contributorEmail = $"remove-test-{Guid.NewGuid():N}@example.com";
        var ownerEmail = $"owner-rm-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, "Test@123456", "Contributor");

        var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Verify contributor can login before removal
        var preRemovalLogin = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { Email = contributorEmail, Password = "Test@123456" });
        preRemovalLogin.StatusCode.Should().Be(HttpStatusCode.OK);

        // Get contributor's user ID from the user list
        var usersResponse = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/account/users", ownerToken);
        var users = await usersResponse.Content.ReadFromJsonAsync<GetAccountUsersResponse>();
        var contributorUser = users!.Items.First(u => u.Email == contributorEmail);

        // Act — remove the contributor
        var removeResponse = await SendWithAuthAsync(HttpMethod.Delete, $"/api/v1/account/users/{contributorUser.UserId}", ownerToken);
        removeResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Assert — removed user cannot login (EmailConfirmed set to false → "Please verify your email" → 401)
        var postRemovalLogin = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { Email = contributorEmail, Password = "Test@123456" });
        postRemovalLogin.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Task 8.11: Role change is enforced
    [Fact]
    public async Task UpdateUserRole_RoleChangeEnforced()
    {
        // Arrange — start with two owners so we can demote one
        var owner1Email = $"owner1-enforce-{Guid.NewGuid():N}@example.com";
        var owner2Email = $"owner2-enforce-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(owner1Email, "Test@123456", "Owner");
        var owner2Id = await _factory.CreateTestUserInAccountAsync(accountId, owner2Email, "Test@123456", "Owner");

        var owner1Token = await GetAccessTokenAsync(owner1Email, "Test@123456");
        var owner2Token = await GetAccessTokenAsync(owner2Email, "Test@123456");

        // Verify owner2 can access owner-only endpoint before demotion
        var preChangeResponse = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/account/users", owner2Token);
        preChangeResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act — demote owner2 to Contributor
        var demoteResponse = await SendWithAuthAsync(HttpMethod.Put, $"/api/v1/account/users/{owner2Id}/role", owner1Token, new { Role = "Contributor" });
        demoteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Re-login to get a new token with updated role claims
        var newOwner2Token = await GetAccessTokenAsync(owner2Email, "Test@123456");

        // Assert — demoted user gets 403 on Owner-only endpoint
        var postChangeResponse = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/account/users", newOwner2Token);
        postChangeResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== DTOs ====================
    private record LoginResponse(string AccessToken, int ExpiresIn);
    private record GetAccountUsersResponse(List<AccountUserItem> Items, int TotalCount);
    private record AccountUserItem(Guid UserId, string Email, string? DisplayName, string Role, DateTime CreatedAt);
}
