using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Income;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for IncomeController CRUD operations.
/// Covers Create, GetById, GetByProperty, GetTotal, Update, Delete endpoints.
/// </summary>
public class IncomeControllerCrudTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public IncomeControllerCrudTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // POST /api/v1/income Tests (Create)
    // =====================================================

    [Fact]
    public async Task CreateIncome_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new
        {
            PropertyId = Guid.NewGuid(),
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/income", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateIncome_WithValidData_Returns201()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            PropertyId = propertyId,
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Monthly rent"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateIncomeResponse>();
        content.Should().NotBeNull();
        content!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateIncome_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            PropertyId = Guid.NewGuid(),
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateIncome_OtherAccountProperty_Returns404()
    {
        // Arrange
        var (_, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();
        var request = new
        {
            PropertyId = propertyId1,
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act - User 2 tries to create income for User 1's property
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateIncome_ZeroAmount_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            PropertyId = propertyId,
            Amount = 0m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateIncome_NegativeAmount_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            PropertyId = propertyId,
            Amount = -100m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateIncome_EmptyPropertyId_Returns400()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var request = new
        {
            PropertyId = Guid.Empty,
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateIncome_WithOptionalFieldsNull_Returns201()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var request = new
        {
            PropertyId = propertyId,
            Amount = 1500.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = (string?)null,
            Description = (string?)null
        };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // =====================================================
    // GET /api/v1/income/{id} Tests (GetById)
    // =====================================================

    [Fact]
    public async Task GetIncomeById_WithoutAuth_Returns401()
    {
        // Arrange
        var incomeId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/income/{incomeId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomeById_ValidId_ReturnsIncome()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "Monthly rent");

        // Act
        var response = await GetWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<IncomeDto>();
        content.Should().NotBeNull();
        content!.Id.Should().Be(incomeId);
        content.Amount.Should().Be(1500.00m);
        content.Description.Should().Be("Monthly rent");
    }

    [Fact]
    public async Task GetIncomeById_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/income/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetIncomeById_OtherAccountIncome_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();
        var incomeId = await CreateIncomeAsync(propertyId1, accessToken1);

        // Act - User 2 tries to get User 1's income
        var response = await GetWithAuthAsync($"/api/v1/income/{incomeId}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // GET /api/v1/properties/{id}/income Tests (GetByProperty)
    // =====================================================

    [Fact]
    public async Task GetIncomeByProperty_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/properties/{propertyId}/income");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomeByProperty_EmptyProperty_ReturnsEmptyList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<IncomeListDto>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetIncomeByProperty_WithIncome_ReturnsList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "Rent 1");
        await CreateIncomeAsync(propertyId, accessToken, 1600.00m, "Rent 2");

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<IncomeListDto>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(2);
        content.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetIncomeByProperty_WithYearFilter_ReturnsFilteredList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "2024", new DateOnly(2024, 6, 15));
        await CreateIncomeAsync(propertyId, accessToken, 1600.00m, "2025", new DateOnly(2025, 6, 15));

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income?year=2025", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<IncomeListDto>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("2025");
    }

    [Fact]
    public async Task GetIncomeByProperty_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentPropertyId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{nonExistentPropertyId}/income", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetIncomeByProperty_OtherAccountProperty_Returns404()
    {
        // Arrange
        var (_, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // Act - User 2 tries to get income for User 1's property
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId1}/income", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // GET /api/v1/properties/{id}/income/total Tests
    // =====================================================

    [Fact]
    public async Task GetIncomeTotalByProperty_WithoutAuth_Returns401()
    {
        // Arrange
        var propertyId = Guid.NewGuid();

        // Act
        var response = await _client.GetAsync($"/api/v1/properties/{propertyId}/income/total");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomeTotalByProperty_NoIncome_ReturnsZero()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income/total", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<IncomeTotalResponse>();
        content.Should().NotBeNull();
        content!.Total.Should().Be(0);
    }

    [Fact]
    public async Task GetIncomeTotalByProperty_WithIncome_ReturnsTotal()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var currentYear = DateTime.UtcNow.Year;
        await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "Rent 1", DateOnly.FromDateTime(new DateTime(currentYear, 1, 15)));
        await CreateIncomeAsync(propertyId, accessToken, 1600.00m, "Rent 2", DateOnly.FromDateTime(new DateTime(currentYear, 2, 15)));

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income/total?year={currentYear}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<IncomeTotalResponse>();
        content.Should().NotBeNull();
        content!.Total.Should().Be(3100.00m);
        content.Year.Should().Be(currentYear);
    }

    [Fact]
    public async Task GetIncomeTotalByProperty_DefaultsToCurrentYear()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var currentYear = DateTime.UtcNow.Year;
        await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "Current Year", DateOnly.FromDateTime(new DateTime(currentYear, 6, 15)));
        await CreateIncomeAsync(propertyId, accessToken, 2000.00m, "Last Year", DateOnly.FromDateTime(new DateTime(currentYear - 1, 6, 15)));

        // Act - No year parameter
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income/total", accessToken);

        // Assert
        var content = await response.Content.ReadFromJsonAsync<IncomeTotalResponse>();
        content!.Total.Should().Be(1500.00m); // Only current year
        content.Year.Should().Be(currentYear);
    }

    [Fact]
    public async Task GetIncomeTotalByProperty_NonExistentProperty_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentPropertyId = Guid.NewGuid();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{nonExistentPropertyId}/income/total", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetIncomeTotalByProperty_OtherAccountProperty_Returns404()
    {
        // Arrange
        var (_, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId1}/income/total", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // =====================================================
    // PUT /api/v1/income/{id} Tests (Update)
    // =====================================================

    [Fact]
    public async Task UpdateIncome_WithoutAuth_Returns401()
    {
        // Arrange
        var incomeId = Guid.NewGuid();
        var request = new
        {
            Amount = 1600.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Updated Tenant",
            Description = "Updated rent"
        };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/v1/income/{incomeId}", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateIncome_ValidUpdate_Returns204()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "Original");

        var request = new
        {
            Amount = 1600.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Updated Tenant",
            Description = "Updated rent"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/income/{incomeId}", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify update persisted
        var getResponse = await GetWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);
        var income = await getResponse.Content.ReadFromJsonAsync<IncomeDto>();
        income!.Amount.Should().Be(1600.00m);
        income.Description.Should().Be("Updated rent");
    }

    [Fact]
    public async Task UpdateIncome_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();
        var request = new
        {
            Amount = 1600.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/income/{nonExistentId}", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateIncome_OtherAccountIncome_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();
        var incomeId = await CreateIncomeAsync(propertyId1, accessToken1);

        var request = new
        {
            Amount = 1600.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Hacker",
            Description = "Stolen"
        };

        // Act - User 2 tries to update User 1's income
        var response = await PutAsJsonWithAuthAsync($"/api/v1/income/{incomeId}", request, accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateIncome_ZeroAmount_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken);

        var request = new
        {
            Amount = 0m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/income/{incomeId}", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateIncome_NegativeAmount_Returns400()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken);

        var request = new
        {
            Amount = -100m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = "Rent"
        };

        // Act
        var response = await PutAsJsonWithAuthAsync($"/api/v1/income/{incomeId}", request, accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // =====================================================
    // DELETE /api/v1/income/{id} Tests
    // =====================================================

    [Fact]
    public async Task DeleteIncome_WithoutAuth_Returns401()
    {
        // Arrange
        var incomeId = Guid.NewGuid();

        // Act
        var response = await _client.DeleteAsync($"/api/v1/income/{incomeId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteIncome_ValidId_Returns204()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken);

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteIncome_ValidId_SoftDeletesRecord()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken);

        // Act
        await DeleteWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Assert - Check database for soft delete
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var income = await dbContext.Income
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == incomeId);

        income.Should().NotBeNull();
        income!.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteIncome_NonExistentId_Returns404()
    {
        // Arrange
        var accessToken = await GetAccessTokenAsync();
        var nonExistentId = Guid.NewGuid();

        // Act
        var response = await DeleteWithAuthAsync($"/api/v1/income/{nonExistentId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteIncome_OtherAccountIncome_Returns404()
    {
        // Arrange
        var (accessToken1, propertyId1) = await CreateUserWithPropertyAsync();
        var accessToken2 = await GetAccessTokenAsync();
        var incomeId = await CreateIncomeAsync(propertyId1, accessToken1);

        // Act - User 2 tries to delete User 1's income
        var response = await DeleteWithAuthAsync($"/api/v1/income/{incomeId}", accessToken2);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteIncome_AlreadyDeleted_Returns404()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken);

        // Delete once
        await DeleteWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Act - Try to delete again
        var response = await DeleteWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteIncome_ExcludedFromGetById()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        var incomeId = await CreateIncomeAsync(propertyId, accessToken);

        // Delete
        await DeleteWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/income/{incomeId}", accessToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteIncome_ExcludedFromPropertyList()
    {
        // Arrange
        var (accessToken, propertyId) = await CreateUserWithPropertyAsync();
        _ = await CreateIncomeAsync(propertyId, accessToken, 1500.00m, "Keep");
        var incomeId2 = await CreateIncomeAsync(propertyId, accessToken, 1600.00m, "Delete");

        // Delete one
        await DeleteWithAuthAsync($"/api/v1/income/{incomeId2}", accessToken);

        // Act
        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/income", accessToken);

        // Assert
        var content = await response.Content.ReadFromJsonAsync<IncomeListDto>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("Keep");
    }

    // =====================================================
    // Helper Methods
    // =====================================================

    private async Task<string> GetAccessTokenAsync()
    {
        var email = $"income-crud-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await _factory.CreateTestUserAsync(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return loginContent!.AccessToken;
    }

    private async Task<(string AccessToken, Guid PropertyId)> CreateUserWithPropertyAsync()
    {
        var email = $"income-crud-{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await _factory.CreateTestUserAsync(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();

        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        var accessToken = loginContent!.AccessToken;

        var propertyRequest = new
        {
            Name = "Test Property for Income",
            Street = "123 Income Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var propertyResponse = await PostAsJsonWithAuthAsync("/api/v1/properties", propertyRequest, accessToken);
        var propertyContent = await propertyResponse.Content.ReadFromJsonAsync<CreatePropertyResponse>();

        return (accessToken, propertyContent!.Id);
    }

    private async Task<Guid> CreateIncomeAsync(
        Guid propertyId,
        string accessToken,
        decimal amount = 1500.00m,
        string? description = null,
        DateOnly? date = null)
    {
        var request = new
        {
            PropertyId = propertyId,
            Amount = amount,
            Date = date ?? DateOnly.FromDateTime(DateTime.Today),
            Source = "Tenant",
            Description = description ?? "Monthly rent"
        };
        var response = await PostAsJsonWithAuthAsync("/api/v1/income", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateIncomeResponse>();
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
}

// =====================================================
// Response DTOs (file-scoped to avoid conflicts)
// =====================================================

file record CreateIncomeResponse(Guid Id);

file record IncomeTotalResponse(decimal Total, int Year);

file record IncomeListDto(
    List<IncomeDto> Items,
    int TotalCount,
    decimal YtdTotal);

file record CreatePropertyResponse(Guid Id);

file record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt);
