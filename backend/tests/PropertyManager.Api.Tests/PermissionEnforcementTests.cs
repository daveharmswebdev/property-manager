using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace PropertyManager.Api.Tests;

public class PermissionEnforcementTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public PermissionEnforcementTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // ==================== HELPER METHODS ====================

    private async Task<(string OwnerToken, string ContributorToken, Guid AccountId)> CreateOwnerAndContributorInSameAccountAsync()
    {
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";

        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, "Test@123456", "Contributor");

        var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");
        var contributorToken = await GetAccessTokenAsync(contributorEmail, "Test@123456");

        return (ownerToken, contributorToken, accountId);
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

    // ==================== PROPERTIES TESTS (AC #1, #2, #6, #9) ====================

    // Task 12.3: Owner can create property
    [Fact]
    public async Task PropertiesCreate_AsOwner_Returns201()
    {
        // Arrange
        var (ownerToken, _, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { Name = "Test Property", Street = "123 Main St", City = "Austin", State = "TX", ZipCode = "78701" };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/properties", ownerToken, request);

        // Assert — AC #9: Owner gets normal response
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // Task 12.4: Contributor blocked from creating property
    [Fact]
    public async Task PropertiesCreate_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { Name = "Test Property", Street = "123 Main St", City = "Austin", State = "TX", ZipCode = "78701" };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/properties", contributorToken, request);

        // Assert — AC #1: Contributor blocked from create property
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Task 12.5: Contributor can list properties
    [Fact]
    public async Task PropertiesGetAll_AsContributor_Returns200()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/properties", contributorToken);

        // Assert — AC #6: Contributor can list properties
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Task 12.6: Contributor blocked from property detail
    [Fact]
    public async Task PropertiesGetById_AsContributor_Returns403()
    {
        // Arrange — Owner creates a property, Contributor tries to view detail
        var (ownerToken, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var createRequest = new { Name = "Detail Test", Street = "456 Oak St", City = "Dallas", State = "TX", ZipCode = "75201" };
        var createResponse = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/properties", ownerToken, createRequest);
        var created = await createResponse.Content.ReadFromJsonAsync<IdResponse>();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, $"/api/v1/properties/{created!.Id}", contributorToken);

        // Assert — AC #2: Contributor blocked from property detail (Owner-only)
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Task 12.7: Contributor blocked from editing property
    [Fact]
    public async Task PropertiesUpdate_AsContributor_Returns403()
    {
        // Arrange
        var (ownerToken, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var createRequest = new { Name = "Edit Test", Street = "789 Elm St", City = "Houston", State = "TX", ZipCode = "77001" };
        var createResponse = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/properties", ownerToken, createRequest);
        var created = await createResponse.Content.ReadFromJsonAsync<IdResponse>();

        var updateRequest = new { Name = "Updated", Street = "789 Elm St", City = "Houston", State = "TX", ZipCode = "77001" };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Put, $"/api/v1/properties/{created!.Id}", contributorToken, updateRequest);

        // Assert — AC #2: Contributor blocked from updating property
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // Task 12.8: Contributor blocked from deleting property
    [Fact]
    public async Task PropertiesDelete_AsContributor_Returns403()
    {
        // Arrange
        var (ownerToken, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var createRequest = new { Name = "Delete Test", Street = "321 Pine St", City = "San Antonio", State = "TX", ZipCode = "78201" };
        var createResponse = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/properties", ownerToken, createRequest);
        var created = await createResponse.Content.ReadFromJsonAsync<IdResponse>();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Delete, $"/api/v1/properties/{created!.Id}", contributorToken);

        // Assert — AC #2: Contributor blocked from deleting property
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== EXPENSES TESTS (AC #3, #9) ====================

    // Task 12.9: Contributor blocked from expenses
    [Fact]
    public async Task ExpensesGetAll_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/expenses", contributorToken);

        // Assert — AC #3: Contributor blocked from all expense endpoints
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== INCOME TESTS (AC #4, #9) ====================

    // Task 12.10: Contributor blocked from income
    [Fact]
    public async Task IncomeGetAll_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/income", contributorToken);

        // Assert — AC #4: Contributor blocked from all income endpoints
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== VENDORS TESTS (AC #5, #9) ====================

    // Task 12.11: Contributor blocked from vendors
    [Fact]
    public async Task VendorsGetAll_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/vendors", contributorToken);

        // Assert — AC #5: Contributor blocked from all vendor endpoints
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== RECEIPTS TESTS (AC #7, #8, #9) ====================

    // Task 12.12: Contributor can view receipts
    [Fact]
    public async Task ReceiptsGetUnprocessed_AsContributor_Returns200()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/receipts/unprocessed", contributorToken);

        // Assert — AC #7: Contributor can view receipts
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Task 12.13: Contributor can upload receipts
    [Fact]
    public async Task ReceiptsUploadUrl_AsContributor_Returns200()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { ContentType = "image/jpeg", FileSizeBytes = 1024 };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/receipts/upload-url", contributorToken, request);

        // Assert — AC #7: Contributor can upload receipts
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Task 12.14: Contributor blocked from processing receipts
    [Fact]
    public async Task ReceiptsProcess_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var receiptId = Guid.NewGuid();
        var request = new { PropertyId = Guid.NewGuid(), Amount = 100.00m, Date = "2026-01-15", CategoryId = Guid.NewGuid() };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, $"/api/v1/receipts/{receiptId}/process", contributorToken, request);

        // Assert — AC #8: Contributor blocked from processing receipts
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== WORK ORDERS TESTS (AC #10, #11, #9) ====================

    // Task 12.15: Contributor can view work orders
    [Fact]
    public async Task WorkOrdersGetAll_AsContributor_Returns200()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/work-orders", contributorToken);

        // Assert — AC #10: Contributor can view work orders
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Task 12.16: Contributor blocked from creating work orders
    [Fact]
    public async Task WorkOrdersCreate_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { PropertyId = Guid.NewGuid(), Description = "Test work order", Status = "Reported" };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/work-orders", contributorToken, request);

        // Assert — AC #11: Contributor blocked from creating work orders
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== REPORTS TESTS (AC #12, #9) ====================

    // Task 12.17: Contributor blocked from reports
    [Fact]
    public async Task ReportsGenerate_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { PropertyId = Guid.NewGuid(), Year = 2026 };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/reports/schedule-e", contributorToken, request);

        // Assert — AC #12: Contributor blocked from reports
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== DASHBOARD TESTS (AC #9) ====================

    // Task 12.18: Contributor blocked from dashboard
    [Fact]
    public async Task DashboardGetTotals_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Get, "/api/v1/dashboard/totals", contributorToken);

        // Assert — Contributor blocked from dashboard (financial data is Owner-only)
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== INVITATIONS TESTS ====================

    // Task 12.19: Contributor blocked from creating invitations
    [Fact]
    public async Task InvitationsCreate_AsContributor_Returns403()
    {
        // Arrange
        var (_, contributorToken, _) = await CreateOwnerAndContributorInSameAccountAsync();
        var request = new { Email = $"newuser-{Guid.NewGuid():N}@example.com", Role = "Owner" };

        // Act
        var response = await SendWithAuthAsync(HttpMethod.Post, "/api/v1/invitations", contributorToken, request);

        // Assert — Contributor blocked from creating invitations
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== DTOs ====================
    private record LoginResponse(string AccessToken, int ExpiresIn);
    private record IdResponse(Guid Id);
}
