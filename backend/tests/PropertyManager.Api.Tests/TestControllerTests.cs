using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for TestController (AC-1, AC-2, AC-4).
/// </summary>
public class TestControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TestControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Reset_WithoutAuth_Returns401()
    {
        // Act
        var response = await _client.PostAsync("/api/v1/test/reset", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Reset_InProductionEnvironment_Returns404()
    {
        // Arrange — create a client with Production environment
        var productionClient = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
        }).CreateClient();

        // Get a valid token first (login still works in any environment)
        var (accessToken, _) = await RegisterAndLoginAsync($"test-prod-{Guid.NewGuid():N}@example.com");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/test/reset");
        request.Headers.Add("Authorization", $"Bearer {accessToken}");

        // Act
        var response = await productionClient.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Reset_WithAuth_DeletesAllEntityTypes_ReturnsCorrectCounts()
    {
        // Arrange — create a user and seed data
        var (accessToken, accountId) = await RegisterAndLoginAsync($"test-reset-{Guid.NewGuid():N}@example.com");

        // Seed test data via API — cover distinct FK patterns
        var propertyId = await CreatePropertyAsync(accessToken);
        var vendorId = await CreateVendorAsync(accessToken);
        await CreateExpenseAsync(accessToken, propertyId);
        await CreateIncomeAsync(accessToken, propertyId);
        var workOrderId = await CreateWorkOrderAsync(accessToken, propertyId);
        await CreateNoteAsync(accessToken, workOrderId);

        // Act
        var response = await PostWithAuthAsync("/api/v1/test/reset", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<TestResetResponseDto>();
        result.Should().NotBeNull();
        result!.Properties.Should().BeGreaterThanOrEqualTo(1);
        result.Expenses.Should().BeGreaterThanOrEqualTo(1);
        result.Income.Should().BeGreaterThanOrEqualTo(1);
        result.Vendors.Should().BeGreaterThanOrEqualTo(1);
        result.WorkOrders.Should().BeGreaterThanOrEqualTo(1);
        result.Notes.Should().BeGreaterThanOrEqualTo(1);
        result.TotalDeleted.Should().BeGreaterThanOrEqualTo(6);

        // Verify data is actually gone from the database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var remainingProperties = await dbContext.Properties
            .IgnoreQueryFilters()
            .Where(p => p.AccountId == accountId)
            .CountAsync();
        remainingProperties.Should().Be(0);

        var remainingExpenses = await dbContext.Expenses
            .IgnoreQueryFilters()
            .Where(e => e.AccountId == accountId)
            .CountAsync();
        remainingExpenses.Should().Be(0);

        var remainingIncome = await dbContext.Income
            .IgnoreQueryFilters()
            .Where(i => i.AccountId == accountId)
            .CountAsync();
        remainingIncome.Should().Be(0);

        var remainingVendors = await dbContext.Vendors
            .IgnoreQueryFilters()
            .Where(v => v.AccountId == accountId)
            .CountAsync();
        remainingVendors.Should().Be(0);

        var remainingWorkOrders = await dbContext.WorkOrders
            .IgnoreQueryFilters()
            .Where(wo => wo.AccountId == accountId)
            .CountAsync();
        remainingWorkOrders.Should().Be(0);

        var remainingNotes = await dbContext.Notes
            .IgnoreQueryFilters()
            .Where(n => n.AccountId == accountId)
            .CountAsync();
        remainingNotes.Should().Be(0);
    }

    [Fact]
    public async Task Reset_PreservesReferenceData()
    {
        // Arrange
        var (accessToken, _) = await RegisterAndLoginAsync($"test-ref-{Guid.NewGuid():N}@example.com");

        // Get reference data counts before reset
        using var scopeBefore = _factory.Services.CreateScope();
        var dbBefore = scopeBefore.ServiceProvider.GetRequiredService<AppDbContext>();
        var categoriesBefore = await dbBefore.ExpenseCategories.IgnoreQueryFilters().CountAsync();
        var woTagsBefore = await dbBefore.WorkOrderTags.IgnoreQueryFilters().CountAsync();
        var tradeTagsBefore = await dbBefore.VendorTradeTags.IgnoreQueryFilters().CountAsync();

        // Act
        var response = await PostWithAuthAsync("/api/v1/test/reset", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert — reference data counts unchanged
        using var scopeAfter = _factory.Services.CreateScope();
        var dbAfter = scopeAfter.ServiceProvider.GetRequiredService<AppDbContext>();
        var categoriesAfter = await dbAfter.ExpenseCategories.IgnoreQueryFilters().CountAsync();
        var woTagsAfter = await dbAfter.WorkOrderTags.IgnoreQueryFilters().CountAsync();
        var tradeTagsAfter = await dbAfter.VendorTradeTags.IgnoreQueryFilters().CountAsync();

        categoriesAfter.Should().Be(categoriesBefore);
        woTagsAfter.Should().Be(woTagsBefore);
        tradeTagsAfter.Should().Be(tradeTagsBefore);
    }

    [Fact]
    public async Task Reset_PreservesAccountAndUser()
    {
        // Arrange
        var email = $"test-preserve-{Guid.NewGuid():N}@example.com";
        var (accessToken, accountId) = await RegisterAndLoginAsync(email);
        await CreatePropertyAsync(accessToken);

        // Act
        var response = await PostWithAuthAsync("/api/v1/test/reset", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert — account still exists
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.Accounts
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == accountId);
        account.Should().NotBeNull();

        // Assert — user can still login
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { Email = email, Password = "Test@123456" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Reset_WithEmptyAccount_Returns200WithZeroEntityCounts()
    {
        // Arrange — new account with no user-created data
        var (accessToken, _) = await RegisterAndLoginAsync($"test-empty-{Guid.NewGuid():N}@example.com");

        // Act
        var response = await PostWithAuthAsync("/api/v1/test/reset", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<TestResetResponseDto>();
        result.Should().NotBeNull();
        // User-created entities should all be 0
        result!.Properties.Should().Be(0);
        result.Expenses.Should().Be(0);
        result.Income.Should().Be(0);
        result.Vendors.Should().Be(0);
        result.WorkOrders.Should().Be(0);
        // RefreshTokens may be non-zero since login creates one
    }

    [Fact]
    public async Task Reset_DoesNotAffectOtherAccounts()
    {
        // Arrange — two separate accounts with data
        var (token1, account1) = await RegisterAndLoginAsync($"test-iso1-{Guid.NewGuid():N}@example.com");
        var (token2, account2) = await RegisterAndLoginAsync($"test-iso2-{Guid.NewGuid():N}@example.com");

        await CreatePropertyAsync(token1);
        await CreatePropertyAsync(token2);

        // Act — reset account 1 only
        var response = await PostWithAuthAsync("/api/v1/test/reset", token1);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert — account 2 data is untouched
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account2Properties = await dbContext.Properties
            .IgnoreQueryFilters()
            .Where(p => p.AccountId == account2)
            .CountAsync();
        account2Properties.Should().BeGreaterThanOrEqualTo(1);
    }

    // --- Helper methods ---

    private async Task<(string AccessToken, Guid AccountId)> RegisterAndLoginAsync(string email)
    {
        var password = "Test@123456";
        var (_, accountId) = await _factory.CreateTestUserAsync(email, password);

        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { Email = email, Password = password });
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponseDto>();
        return (loginContent!.AccessToken, accountId);
    }

    private async Task<HttpResponseMessage> PostWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<Guid> CreatePropertyAsync(string accessToken)
    {
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", new
        {
            Name = $"Test Property {Guid.NewGuid():N}",
            Street = "123 Test St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        }, accessToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CreateEntityResponseDto>();
        return content!.Id;
    }

    private async Task<Guid> CreateVendorAsync(string accessToken)
    {
        var response = await PostAsJsonWithAuthAsync("/api/v1/vendors", new
        {
            FirstName = "Test",
            LastName = $"Vendor{Guid.NewGuid():N}",
            CompanyName = "Test Co"
        }, accessToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CreateEntityResponseDto>();
        return content!.Id;
    }

    private async Task CreateExpenseAsync(string accessToken, Guid propertyId)
    {
        // Get a valid category ID first
        var catRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/expense-categories");
        catRequest.Headers.Add("Authorization", $"Bearer {accessToken}");
        var catResponse = await _client.SendAsync(catRequest);
        catResponse.EnsureSuccessStatusCode();
        var categoriesResponse = await catResponse.Content.ReadFromJsonAsync<CategoriesListDto>();

        var response = await PostAsJsonWithAuthAsync("/api/v1/expenses", new
        {
            Amount = 100.00m,
            Date = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
            CategoryId = categoriesResponse!.Items.First().Id,
            PropertyId = propertyId,
            Description = "Test expense for reset"
        }, accessToken);
        response.EnsureSuccessStatusCode();
    }

    private async Task CreateIncomeAsync(string accessToken, Guid propertyId)
    {
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", new
        {
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
            PropertyId = propertyId,
            Description = "Test income for reset"
        }, accessToken);
        response.EnsureSuccessStatusCode();
    }

    private async Task<Guid> CreateWorkOrderAsync(string accessToken, Guid propertyId)
    {
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", new
        {
            PropertyId = propertyId,
            Description = "Test work order for reset"
        }, accessToken);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CreateEntityResponseDto>();
        return content!.Id;
    }

    private async Task CreateNoteAsync(string accessToken, Guid workOrderId)
    {
        var response = await PostAsJsonWithAuthAsync("/api/v1/notes", new
        {
            EntityType = "WorkOrder",
            EntityId = workOrderId,
            Content = "Test note for reset"
        }, accessToken);
        response.EnsureSuccessStatusCode();
    }

    // --- DTOs ---

    private record LoginResponseDto(string AccessToken, string RefreshToken);
    private record CreateEntityResponseDto(Guid Id);
    private record CategoryDto(Guid Id, string Name, int LineNumber);
    private record CategoriesListDto(List<CategoryDto> Items, int TotalCount);
    private record TestResetResponseDto(
        int WorkOrderTagAssignments,
        int WorkOrderPhotos,
        int Notes,
        int Expenses,
        int Income,
        int WorkOrders,
        int VendorTradeTagAssignments,
        int Vendors,
        int Persons,
        int PropertyPhotos,
        int Receipts,
        int GeneratedReports,
        int Properties,
        int RefreshTokens,
        int TotalDeleted);
}
