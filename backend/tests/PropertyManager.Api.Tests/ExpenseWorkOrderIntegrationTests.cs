using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for Expense-WorkOrder relationship (Story 11.1, AC #1-#9).
/// Tests full flow: create, link, unlink, delete, and tenant isolation.
/// </summary>
public class ExpenseWorkOrderIntegrationTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ExpenseWorkOrderIntegrationTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // Full Flow Tests (AC #5, #6, #9)
    // =====================================================

    [Fact]
    public async Task CreateExpenseWithWorkOrderId_GetExpense_IncludesWorkOrderId()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        // Act - Create expense linked to work order
        var createRequest = new
        {
            PropertyId = propertyId,
            Amount = 150.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            CategoryId = categoryId,
            Description = "Plumbing parts",
            WorkOrderId = workOrderId
        };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/expenses", createRequest, accessToken);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var expenseId = (await createResponse.Content.ReadFromJsonAsync<CreateExpenseIdResponse>())!.Id;

        // Assert - Get expense and verify WorkOrderId is present (AC #5)
        var getResponse = await GetWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var expense = await getResponse.Content.ReadFromJsonAsync<ExpenseDetailResponse>();
        expense.Should().NotBeNull();
        expense!.WorkOrderId.Should().Be(workOrderId);
    }

    [Fact]
    public async Task GetWorkOrderExpenses_LinkedExpenses_ReturnsListWithCount()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        // Create 2 expenses linked to work order
        await CreateExpenseWithWorkOrderAsync(propertyId, workOrderId, categoryId, accessToken, 100.00m, "Parts");
        await CreateExpenseWithWorkOrderAsync(propertyId, workOrderId, categoryId, accessToken, 200.00m, "Labor");

        // Act (AC #6)
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{workOrderId}/expenses", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<WorkOrderExpensesListResponse>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetWorkOrderExpenses_NoLinkedExpenses_ReturnsEmptyList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);

        // Act (AC #6 - empty case)
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{workOrderId}/expenses", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<WorkOrderExpensesListResponse>();
        result!.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task UpdateExpense_ClearWorkOrderId_UnlinksExpense()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseWithWorkOrderAsync(propertyId, workOrderId, categoryId, accessToken);

        // Act - Update expense with null WorkOrderId (AC #9)
        var updateRequest = new
        {
            Amount = 100.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            CategoryId = categoryId,
            Description = "Updated",
            WorkOrderId = (Guid?)null
        };
        var updateResponse = await PutAsJsonWithAuthAsync($"/api/v1/expenses/{expenseId}", updateRequest, accessToken);

        // Assert
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResponse = await GetWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        var expense = await getResponse.Content.ReadFromJsonAsync<ExpenseDetailResponse>();
        expense!.WorkOrderId.Should().BeNull();
    }

    [Fact]
    public async Task DeleteWorkOrder_LinkedExpense_ExpenseRemainsIntact()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseWithWorkOrderAsync(propertyId, workOrderId, categoryId, accessToken);

        // Act - Soft-delete the work order
        var deleteResponse = await DeleteWithAuthAsync($"/api/v1/work-orders/{workOrderId}", accessToken);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Assert - Expense still exists and is NOT deleted
        // Note: Soft delete does not trigger FK ON DELETE SET NULL (only physical DELETE does).
        // The FK SET NULL is a database-level safety net for hard deletes.
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var expense = await dbContext.Expenses
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == expenseId);

        expense.Should().NotBeNull();
        expense!.DeletedAt.Should().BeNull(); // expense itself NOT deleted
        expense.Amount.Should().BeGreaterThan(0); // data intact
    }

    // =====================================================
    // Property Isolation Tests (AC #7)
    // =====================================================

    [Fact]
    public async Task CreateExpense_CrossPropertyWorkOrder_Returns400()
    {
        // Arrange - 2 properties, work order on prop1, expense on prop2
        var email = $"cross-prop-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var property1 = await CreatePropertyAsync(accessToken, "Property 1");
        var property2 = await CreatePropertyAsync(accessToken, "Property 2");
        var workOrderId = await CreateWorkOrderAsync(property1, accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        // Act - Try to link expense on property2 to work order on property1 (AC #7)
        var createRequest = new
        {
            PropertyId = property2,
            Amount = 100.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            CategoryId = categoryId,
            Description = "Cross-property test",
            WorkOrderId = workOrderId
        };
        var response = await PostAsJsonWithAuthAsync("/api/v1/expenses", createRequest, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // Tenant Isolation Tests (AC #6 + multi-tenant)
    // =====================================================

    [Fact]
    public async Task GetWorkOrderExpenses_OtherAccountWorkOrder_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var workOrderId = await CreateWorkOrderAsync(propertyId1, accessToken1);

        var accessToken2 = await GetAccessTokenAsync();

        // Act - User 2 tries to access User 1's work order expenses
        var response = await GetWithAuthAsync($"/api/v1/work-orders/{workOrderId}/expenses", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateExpenseWithWorkOrder_NullWorkOrderId_BackwardCompat()
    {
        // Arrange (AC #8 - backward compatibility)
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        // Act - Create expense WITHOUT WorkOrderId (old behavior)
        var createRequest = new
        {
            PropertyId = propertyId,
            Amount = 100.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            CategoryId = categoryId,
            Description = "No work order"
        };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/expenses", createRequest, accessToken);

        // Assert
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var expenseId = (await createResponse.Content.ReadFromJsonAsync<CreateExpenseIdResponse>())!.Id;

        var getResponse = await GetWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        var expense = await getResponse.Content.ReadFromJsonAsync<ExpenseDetailResponse>();
        expense!.WorkOrderId.Should().BeNull();
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
        var (userId, _) = await _factory.CreateTestUserAsync(email, password);
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, userId);
    }

    private async Task<(string AccessToken, Guid PropertyId)> CreateUserWithPropertyAsync()
    {
        var email = $"ewoi-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        return (accessToken, propertyId);
    }

    private async Task<Guid> CreatePropertyAsync(string accessToken, string name = "Test Property")
    {
        var request = new
        {
            Name = name,
            Street = "123 Test St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreatePropertyResponse>();
        return content!.Id;
    }

    private async Task<Guid> CreateWorkOrderAsync(Guid propertyId, string accessToken)
    {
        var request = new
        {
            PropertyId = propertyId,
            Description = "Test work order"
        };
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderIdResponse>();
        return content!.Id;
    }

    private async Task<Guid> GetFirstCategoryIdAsync(string accessToken)
    {
        var response = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
        response.EnsureSuccessStatusCode();
        var categories = await response.Content.ReadFromJsonAsync<ExpenseCategoriesListResponse>();
        return categories!.Items[0].Id;
    }

    private async Task<Guid> CreateExpenseWithWorkOrderAsync(
        Guid propertyId, Guid workOrderId, Guid categoryId, string accessToken,
        decimal amount = 100.00m, string description = "Test expense")
    {
        var request = new
        {
            PropertyId = propertyId,
            Amount = amount,
            Date = DateOnly.FromDateTime(DateTime.Today),
            CategoryId = categoryId,
            Description = description,
            WorkOrderId = workOrderId
        };
        var response = await PostAsJsonWithAuthAsync("/api/v1/expenses", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateExpenseIdResponse>();
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

    private async Task<HttpResponseMessage> PutAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    // Response DTOs for deserialization
    private record CreateExpenseIdResponse(Guid Id);
    private record CreateWorkOrderIdResponse(Guid Id);
    private record CreatePropertyResponse(Guid Id);
    private record LoginResponse(string AccessToken);
    private record ExpenseDetailResponse(
        Guid Id, Guid PropertyId, string PropertyName, Guid CategoryId, string CategoryName,
        string? ScheduleELine, decimal Amount, DateOnly Date, string? Description,
        Guid? ReceiptId, Guid? WorkOrderId, DateTime CreatedAt);
    private record WorkOrderExpensesListResponse(List<WorkOrderExpenseItem> Items, int TotalCount);
    private record WorkOrderExpenseItem(Guid Id, DateOnly Date, string? Description, string CategoryName, decimal Amount);
    private record ExpenseCategoriesListResponse(List<ExpenseCategoryItem> Items, int TotalCount);
    private record ExpenseCategoryItem(Guid Id, string Name);
}
