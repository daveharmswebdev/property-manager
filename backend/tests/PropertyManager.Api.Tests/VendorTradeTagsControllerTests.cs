using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for VendorTradeTagsController.
/// Tests vendor trade tag listing and creation endpoints (AC #3, #4, #5).
/// </summary>
public class VendorTradeTagsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public VendorTradeTagsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // GET /api/v1/vendor-trade-tags Tests
    // =====================================================

    [Fact]
    public async Task GetAllVendorTradeTags_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/vendor-trade-tags");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAllVendorTradeTags_NoTags_ReturnsEmptyList()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync("/api/v1/vendor-trade-tags", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllVendorTradeTagsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllVendorTradeTags_WithTags_ReturnsList()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        await CreateTradeTagAsync("Plumber", accessToken);
        await CreateTradeTagAsync("Electrician", accessToken);
        await CreateTradeTagAsync("HVAC", accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/vendor-trade-tags", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<GetAllVendorTradeTagsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(3);
        content.TotalCount.Should().Be(3);
    }

    [Fact]
    public async Task GetAllVendorTradeTags_SortedAlphabetically()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        await CreateTradeTagAsync("Zebra Contractor", accessToken);
        await CreateTradeTagAsync("Alpha Plumber", accessToken);
        await CreateTradeTagAsync("Middle HVAC", accessToken);

        // Act
        var response = await GetWithAuthAsync("/api/v1/vendor-trade-tags", accessToken);

        // Assert
        var content = await response.Content.ReadFromJsonAsync<GetAllVendorTradeTagsResponse>();
        content!.Items.Should().HaveCount(3);
        content.Items[0].Name.Should().Be("Alpha Plumber");
        content.Items[1].Name.Should().Be("Middle HVAC");
        content.Items[2].Name.Should().Be("Zebra Contractor");
    }

    [Fact]
    public async Task GetAllVendorTradeTags_MultiTenantIsolation()
    {
        // Arrange
        var accessToken1 = await GetAccessTokenAsync();
        var accessToken2 = await GetAccessTokenAsync();

        await CreateTradeTagAsync("User1 Plumber", accessToken1);
        await CreateTradeTagAsync("User2 Electrician", accessToken2);

        // Act - User 1 gets their tags
        var response = await GetWithAuthAsync("/api/v1/vendor-trade-tags", accessToken1);

        // Assert - User 1 only sees their tags
        var content = await response.Content.ReadFromJsonAsync<GetAllVendorTradeTagsResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Name.Should().Be("User1 Plumber");
    }

    // =====================================================
    // POST /api/v1/vendor-trade-tags Tests
    // =====================================================

    [Fact]
    public async Task CreateVendorTradeTag_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new { Name = "Plumber" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/vendor-trade-tags", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateVendorTradeTag_ValidData_Returns201()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { Name = "New Trade Tag" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateVendorTradeTagResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateVendorTradeTag_EmptyName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { Name = "" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendorTradeTag_NullName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { Name = (string?)null };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendorTradeTag_WhitespaceName_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { Name = "   " };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendorTradeTag_NameTooLong_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var longName = new string('a', 101); // Exceeds 100 char limit
        var request = new { Name = longName };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVendorTradeTag_MaxLengthName_Returns201()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var maxName = new string('a', 100); // Exactly 100 chars
        var request = new { Name = maxName };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateVendorTradeTag_DuplicateName_Returns409()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        await CreateTradeTagAsync("Existing Tag", accessToken);

        var request = new { Name = "Existing Tag" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateVendorTradeTag_DuplicateNameCaseInsensitive_Returns409()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        await CreateTradeTagAsync("Plumber", accessToken);

        var request = new { Name = "PLUMBER" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateVendorTradeTag_SameNameDifferentAccount_Returns201()
    {
        // Arrange
        var accessToken1 = await GetAccessTokenAsync();
        var accessToken2 = await GetAccessTokenAsync();

        await CreateTradeTagAsync("Plumber", accessToken1);

        var request = new { Name = "Plumber" };

        // Act - User 2 creates same name (allowed - different account)
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateVendorTradeTag_TrimsWhitespace()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new { Name = "  Trimmed Name  " };

        // Act
        await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);

        // Verify
        var getResponse = await GetWithAuthAsync("/api/v1/vendor-trade-tags", accessToken);
        var content = await getResponse.Content.ReadFromJsonAsync<GetAllVendorTradeTagsResponse>();
        content!.Items.Should().ContainSingle(t => t.Name == "Trimmed Name");
    }

    [Fact]
    public async Task CreateVendorTradeTag_NullBody_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Act
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/vendor-trade-tags");
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create<object?>(null);
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // End-to-End Flow Test
    // =====================================================

    [Fact]
    public async Task VendorTradeTagFlow_CreateAndRetrieve_Succeeds()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();

        // Step 1: Create tags
        var createResponse1 = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", new { Name = "Carpenter" }, accessToken);
        createResponse1.StatusCode.Should().Be(HttpStatusCode.Created);
        var tag1 = await createResponse1.Content.ReadFromJsonAsync<CreateVendorTradeTagResponse>();

        var createResponse2 = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", new { Name = "Painter" }, accessToken);
        createResponse2.StatusCode.Should().Be(HttpStatusCode.Created);
        var tag2 = await createResponse2.Content.ReadFromJsonAsync<CreateVendorTradeTagResponse>();

        // Step 2: Get all tags
        var getResponse = await GetWithAuthAsync("/api/v1/vendor-trade-tags", accessToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var allTags = await getResponse.Content.ReadFromJsonAsync<GetAllVendorTradeTagsResponse>();
        allTags!.Items.Should().HaveCount(2);
        allTags.Items.Should().Contain(t => t.Id == tag1!.Id);
        allTags.Items.Should().Contain(t => t.Id == tag2!.Id);
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"vendor-trade-tags-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await _factory.CreateTestUserAsync(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return loginContent!.AccessToken;
    }

    private async Task<Guid> CreateTradeTagAsync(string name, string accessToken)
    {
        var request = new { Name = name };
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendor-trade-tags", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateVendorTradeTagResponse>();
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
}

// =====================================================
// Response DTOs
// =====================================================

file record GetAllVendorTradeTagsResponse(
    IReadOnlyList<VendorTradeTagDto> Items,
    int TotalCount);

file record VendorTradeTagDto(
    Guid Id,
    string Name);

file record CreateVendorTradeTagResponse(Guid Id);

file record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt);
