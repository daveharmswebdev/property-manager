using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for WorkOrderTagsController.
/// Tests CRUD operations for work order tags including validation, authorization, and multi-tenancy.
/// </summary>
public class WorkOrderTagsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public WorkOrderTagsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // GET /api/v1/work-order-tags Tests
    // =====================================================

    [Fact]
    public async Task GetAllWorkOrderTags_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/work-order-tags");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAllWorkOrderTags_WithAuth_ReturnsEmptyList()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-order-tags", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrderTagsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllWorkOrderTags_WithTags_ReturnsList()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Create some tags
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "Plumbing" }, accessToken);
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "Electrical" }, accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-order-tags", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrderTagsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(2);
        content.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetAllWorkOrderTags_ReturnsSortedAlphabetically()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Create tags in non-alphabetical order
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "Zoning" }, accessToken);
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "HVAC" }, accessToken);
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "Appliance" }, accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/work-order-tags", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrderTagsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(3);
        content.Items[0].Name.Should().Be("Appliance");
        content.Items[1].Name.Should().Be("HVAC");
        content.Items[2].Name.Should().Be("Zoning");
    }

    [Fact]
    public async Task GetAllWorkOrderTags_OnlyReturnsOwnTags()
    {
        // Arrange - Create tags with two different users
        var accessToken1 = await GetAccessTokenAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // User 1 creates a tag
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "User1Tag" }, accessToken1);

        // User 2 creates a tag
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "User2Tag" }, accessToken2);

        // Act - User 1 gets their tags
        var response = await GetWithAuthAsync("/api/v1/work-order-tags", accessToken1);

        // Assert - Should only see User 1's tag
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllWorkOrderTagsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Name.Should().Be("User1Tag");
    }

    // =====================================================
    // POST /api/v1/work-order-tags Tests
    // =====================================================

    [Fact]
    public async Task CreateWorkOrderTag_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new { Name = "TestTag" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/work-order-tags", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateWorkOrderTag_WithValidName_Returns201WithId()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new { Name = "Emergency" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderTagResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task CreateWorkOrderTag_WithEmptyName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new { Name = "" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateWorkOrderTag_WithNullBody_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act - Send request with empty body
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/work-order-tags");
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateWorkOrderTag_WithTooLongName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var longName = new string('x', 101); // Max is 100
        var request = new { Name = longName };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateWorkOrderTag_WithMaxLengthName_Returns201()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var maxName = new string('x', 100); // Exactly max length
        var request = new { Name = maxName };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateWorkOrderTag_WithDuplicateName_Returns409()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new { Name = "DuplicateTag" };

        // Create first tag
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Act - Try to create duplicate
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateWorkOrderTag_DuplicateCheckIsCaseInsensitive()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Create first tag with lowercase
        await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "urgent" }, accessToken);

        // Act - Try to create same tag with different case
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", new { Name = "URGENT" }, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateWorkOrderTag_SameNameDifferentAccounts_AllowsBoth()
    {
        // Arrange
        var accessToken1 = await GetAccessTokenAsync();
        var accessToken2 = await GetAccessTokenAsync();

        var request = new { Name = "SharedTagName" };

        // User 1 creates tag
        var response1 = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken1);

        // Act - User 2 creates tag with same name
        var response2 = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken2);

        // Assert - Both should succeed (different accounts)
        response1.StatusCode.Should().Be(HttpStatusCode.Created);
        response2.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateWorkOrderTag_ReturnsIdThatCanBeRetrieved()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new { Name = "Retrievable" };

        // Act
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateWorkOrderTagResponse>();

        // Verify tag appears in list
        var listResponse = await GetWithAuthAsync("/api/v1/work-order-tags", accessToken);
        var listContent = await listResponse.Content.ReadFromJsonAsync<GetAllWorkOrderTagsResponse>();

        // Assert
        listContent!.Items.Should().Contain(t => t.Id == createContent!.Id);
        listContent.Items.Should().Contain(t => t.Name == "Retrievable");
    }

    [Fact]
    public async Task CreateWorkOrderTag_TrimsWhitespace()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        var request = new { Name = "  TrimmedTag  " };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-order-tags", request, accessToken);

        // Verify in list
        var listResponse = await GetWithAuthAsync("/api/v1/work-order-tags", accessToken);
        var listContent = await listResponse.Content.ReadFromJsonAsync<GetAllWorkOrderTagsResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        listContent!.Items.Should().Contain(t => t.Name == "TrimmedTag");
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        return accessToken;
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginAsync(string email)
    {
        var password = "Test@123456";

        // Create user directly in database
        var (userId, _) = await _factory.CreateTestUserAsync(email, password);

        // Login
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, userId);
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
// Response DTOs
// =====================================================

public record GetAllWorkOrderTagsResponse(IReadOnlyList<WorkOrderTagListItemDto> Items, int TotalCount);

public record WorkOrderTagListItemDto(Guid Id, string Name);

public record CreateWorkOrderTagResponse(Guid Id);
