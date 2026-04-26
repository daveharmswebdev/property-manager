using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

/// <summary>
/// Integration tests for ExpensesController covering all eleven endpoints:
///   POST   /api/v1/expenses
///   PUT    /api/v1/expenses/{id}
///   DELETE /api/v1/expenses/{id}
///   GET    /api/v1/expenses
///   GET    /api/v1/expenses/{id}
///   GET    /api/v1/properties/{id}/expenses
///   POST   /api/v1/expenses/{id}/link-receipt
///   DELETE /api/v1/expenses/{id}/receipt
///   GET    /api/v1/expenses/check-duplicate
///   GET    /api/v1/expenses/totals
///   GET    /api/v1/expense-categories
///
/// Exercises the real HTTP + DI + EF Core + JWT auth + global query filter + permission policy stack.
/// See Story 21.3 for AC mapping. Tests assert the SHIPPED controller/handler behavior — any
/// assertion mismatch is a test bug, not a handler bug (test-only story, do not change handlers).
///
/// Consolidates the prior split tests (ExpensesControllerCheckDuplicateTests, ExpensesControllerDeleteTests,
/// ExpensesControllerGetAllTests) — see AC-CONSOL-*.
/// </summary>
public class ExpensesControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ExpensesControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // =====================================================
    // Auth coverage (AC-AUTH-1, AC-AUTH-2)
    // =====================================================

    #region Auth (class-level policy)

    [Fact]
    public async Task CreateExpense_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/expenses",
            new { PropertyId = Guid.NewGuid(), Amount = 100m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateExpense_WithoutAuth_Returns401()
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/v1/expenses/{Guid.NewGuid()}",
            new { Amount = 100m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetExpenseById_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync($"/api/v1/expenses/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetExpensesByProperty_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync($"/api/v1/properties/{Guid.NewGuid()}/expenses");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task LinkReceipt_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/expenses/{Guid.NewGuid()}/link-receipt",
            new { ReceiptId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UnlinkReceipt_WithoutAuth_Returns401()
    {
        var response = await _client.DeleteAsync($"/api/v1/expenses/{Guid.NewGuid()}/receipt");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetExpenseTotals_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/expenses/totals");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetExpenseCategories_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/expense-categories");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AllEndpoints_AsContributor_Returns403()
    {
        // Class-level [Authorize(Policy = "CanAccessExpenses")] requires Expenses.View.
        // Only Owner has it. Contributor -> 403 on every endpoint uniformly. One test covers the policy.
        var ownerEmail = $"owner-{Guid.NewGuid():N}@example.com";
        var (_, accountId) = await _factory.CreateTestUserAsync(ownerEmail);

        var contributorEmail = $"contrib-{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserInAccountAsync(accountId, contributorEmail, role: "Contributor");
        var (accessToken, _) = await LoginAsync(contributorEmail);

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    #endregion

    // =====================================================
    // POST /api/v1/expenses (Create) — AC-CR-*
    // =====================================================

    #region POST /expenses

    [Fact]
    public async Task CreateExpense_AsOwner_ValidBody_Returns201WithIdAndLocation()
    {
        var email = $"create-201-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 127.50m,
                Date = new DateOnly(2025, 6, 1),
                CategoryId = categoryId,
                Description = "Home Depot — Faucet"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
        var body = await response.Content.ReadFromJsonAsync<CreateExpenseResponse>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CreateExpense_Persists_WithCorrectFields()
    {
        var email = $"create-persist-{Guid.NewGuid():N}@example.com";
        var (accessToken, ownerUserId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(ownerUserId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 127.50m,
                Date = new DateOnly(2025, 6, 1),
                CategoryId = categoryId,
                Description = "Home Depot — Faucet"
            },
            accessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<CreateExpenseResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = await dbContext.Expenses
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == body!.Id);

        persisted.Should().NotBeNull();
        persisted!.AccountId.Should().Be(accountId);
        persisted.PropertyId.Should().Be(propertyId);
        persisted.CategoryId.Should().Be(categoryId);
        persisted.Amount.Should().Be(127.50m);
        persisted.Date.Should().Be(new DateOnly(2025, 6, 1));
        persisted.Description.Should().Be("Home Depot — Faucet");
        persisted.CreatedByUserId.Should().Be(ownerUserId);
        persisted.DeletedAt.Should().BeNull();
        persisted.WorkOrderId.Should().BeNull();
        persisted.ReceiptId.Should().BeNull();
    }

    [Fact]
    public async Task CreateExpense_TrimsDescriptionWhitespace()
    {
        var email = $"create-trim-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "   leading and trailing   "
            },
            accessToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<CreateExpenseResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == body!.Id);
        persisted.Description.Should().Be("leading and trailing");
    }

    [Fact]
    public async Task CreateExpense_WithWorkOrderOnSameProperty_Returns201()
    {
        var email = $"create-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 75m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "Plumbing parts",
                WorkOrderId = workOrderId
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<CreateExpenseResponse>();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == body!.Id);
        persisted.WorkOrderId.Should().Be(workOrderId);
    }

    [Fact]
    public async Task CreateExpense_NonExistentProperty_Returns404()
    {
        var email = $"create-bad-prop-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = Guid.NewGuid(),
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "test"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateExpense_CrossAccountProperty_Returns404()
    {
        var emailA = $"create-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"create-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, _) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);

        var propertyB = await CreatePropertyAsync(tokenB);
        var categoryId = await GetFirstCategoryIdAsync(tokenA);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyB,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "cross account"
            },
            tokenA);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateExpense_NonExistentCategory_Returns404()
    {
        var email = $"create-bad-cat-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = Guid.NewGuid(),
                Description = "test"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateExpense_NonExistentWorkOrder_Returns404()
    {
        var email = $"create-bad-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "test",
                WorkOrderId = Guid.NewGuid()
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateExpense_WorkOrderOnDifferentProperty_Returns400_WithMessage()
    {
        var email = $"create-wo-mismatch-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var property1 = await CreatePropertyAsync(accessToken, "P1");
        var property2 = await CreatePropertyAsync(accessToken, "P2");
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        // Work order on P2
        var workOrder2 = await CreateWorkOrderAsync(property2, accessToken);

        // POST expense on P1 with WO from P2
        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = property1,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "cross prop WO",
                WorkOrderId = workOrder2
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("same property");
    }

    [Fact]
    public async Task CreateExpense_AmountZero_Returns400_WithValidationMessage()
    {
        var email = $"val-amt-zero-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 0m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "zero"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var text = await response.Content.ReadAsStringAsync();
        text.Should().Contain("Amount must be greater than $0");
    }

    [Fact]
    public async Task CreateExpense_AmountNegative_Returns400()
    {
        var email = $"val-amt-neg-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = -10m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "neg"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("Amount must be greater than $0");
    }

    [Fact]
    public async Task CreateExpense_AmountOverMax_Returns400()
    {
        var email = $"val-amt-max-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 10000000.00m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "too big"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("Amount exceeds maximum");
    }

    [Fact]
    public async Task CreateExpense_AmountTooManyDecimals_Returns400()
    {
        var email = $"val-amt-dec-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 12.345m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "decimals"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("at most 2 decimal places");
    }

    [Fact]
    public async Task CreateExpense_FutureDate_Returns400()
    {
        var email = $"val-future-date-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today.AddDays(1)),
                CategoryId = categoryId,
                Description = "future"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("Date cannot be in the future");
    }

    [Fact]
    public async Task CreateExpense_EmptyPropertyId_Returns400()
    {
        var email = $"val-empty-prop-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = Guid.Empty,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "empty prop"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("Property is required");
    }

    [Fact]
    public async Task CreateExpense_EmptyCategoryId_Returns400()
    {
        var email = $"val-empty-cat-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = Guid.Empty,
                Description = "empty cat"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("Category is required");
    }

    [Fact]
    public async Task CreateExpense_DescriptionOver500Chars_Returns400()
    {
        var email = $"val-desc-long-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = new string('x', 501)
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("500 characters or less");
    }

    [Fact]
    public async Task CreateExpense_DescriptionContainsHtml_Returns400()
    {
        var email = $"val-desc-html-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "<script>alert('xss')</script>"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("cannot contain HTML");
    }

    [Fact]
    public async Task CreateExpense_EmptyWorkOrderId_Returns400()
    {
        var email = $"val-empty-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PostAsJsonWithAuthAsync(
            "/api/v1/expenses",
            new
            {
                PropertyId = propertyId,
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "empty wo",
                WorkOrderId = Guid.Empty
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("WorkOrderId must be a valid GUID or null");
    }

    #endregion

    // =====================================================
    // PUT /api/v1/expenses/{id} (Update) — AC-PUT-*
    // =====================================================

    #region PUT /expenses/{id}

    [Fact]
    public async Task UpdateExpense_AsOwner_ValidBody_Returns204()
    {
        var email = $"put-ok-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 222m,
                Date = DateOnly.FromDateTime(DateTime.Today.AddDays(-2)),
                CategoryId = categoryId,
                Description = "updated",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)null
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task UpdateExpense_Persists_UpdatedFields_AndPreservesCreatedAt()
    {
        var email = $"put-persist-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, 10m, "before", new DateOnly(2025, 1, 1), categoryId);

        DateTime originalCreatedAt;
        Guid originalCreatedByUserId;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var loaded = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
            originalCreatedAt = loaded.CreatedAt;
            originalCreatedByUserId = loaded.CreatedByUserId;
        }

        var newCategoryId = await GetCategoryIdByNameAsync(accessToken, "Repairs");
        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 333m,
                Date = new DateOnly(2025, 3, 5),
                CategoryId = newCategoryId,
                Description = "  after   ",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)null
            },
            accessToken);
        response.EnsureSuccessStatusCode();

        using var scope2 = _factory.Services.CreateScope();
        var db = scope2.ServiceProvider.GetRequiredService<AppDbContext>();
        var updated = await db.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
        updated.Amount.Should().Be(333m);
        updated.Date.Should().Be(new DateOnly(2025, 3, 5));
        updated.CategoryId.Should().Be(newCategoryId);
        updated.Description.Should().Be("after");
        updated.CreatedAt.Should().Be(originalCreatedAt);
        updated.CreatedByUserId.Should().Be(originalCreatedByUserId);
    }

    [Fact]
    public async Task UpdateExpense_SetsUpdatedAt()
    {
        var email = $"put-updated-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId);

        var before = DateTime.UtcNow.AddSeconds(-2);
        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "after",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)null
            },
            accessToken);
        response.EnsureSuccessStatusCode();
        var after = DateTime.UtcNow.AddSeconds(2);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var loaded = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
        loaded.UpdatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task UpdateExpense_PropertyReassignment_Succeeds()
    {
        var email = $"put-reassign-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var property1 = await CreatePropertyAsync(accessToken, "P1");
        var property2 = await CreatePropertyAsync(accessToken, "P2");
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(property1, accessToken, categoryId: categoryId);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 100m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "reassigned",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)property2
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var loaded = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
        loaded.PropertyId.Should().Be(property2);
    }

    [Fact]
    public async Task UpdateExpense_PropertyReassignment_CrossAccount_Returns404()
    {
        var emailA = $"put-x-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"put-x-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, _) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);

        var propertyA = await CreatePropertyAsync(tokenA);
        var propertyB = await CreatePropertyAsync(tokenB);
        var categoryId = await GetFirstCategoryIdAsync(tokenA);
        var expenseId = await CreateExpenseAsync(propertyA, tokenA, categoryId: categoryId);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 100m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "x",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)propertyB
            },
            tokenA);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateExpense_ClearsWorkOrderId_WhenNullInBody()
    {
        var email = $"put-clear-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId, workOrderId: workOrderId);

        // Precondition
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var loaded = await db.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
            loaded.WorkOrderId.Should().Be(workOrderId);
        }

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "clear wo",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)null
            },
            accessToken);
        response.EnsureSuccessStatusCode();

        using var scope2 = _factory.Services.CreateScope();
        var dbContext = scope2.ServiceProvider.GetRequiredService<AppDbContext>();
        var expense = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
        expense.WorkOrderId.Should().BeNull();
    }

    [Fact]
    public async Task UpdateExpense_NonExistentId_Returns404()
    {
        var email = $"put-404-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{Guid.NewGuid()}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "ghost"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateExpense_CrossAccount_Returns404()
    {
        var emailA = $"put-xacct-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"put-xacct-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, _) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);

        var propertyA = await CreatePropertyAsync(tokenA);
        var categoryId = await GetFirstCategoryIdAsync(tokenA);
        var expenseA = await CreateExpenseAsync(propertyA, tokenA, categoryId: categoryId);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseA}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "x"
            },
            tokenB);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateExpense_SoftDeleted_Returns404()
    {
        var email = $"put-del-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId);
        await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "reanimate"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateExpense_NonExistentCategory_Returns404()
    {
        var email = $"put-bad-cat-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = Guid.NewGuid(),
                Description = "bad cat"
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateExpense_WorkOrderOnDifferentProperty_Returns400()
    {
        var email = $"put-wo-mismatch-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var property1 = await CreatePropertyAsync(accessToken, "P1");
        var property2 = await CreatePropertyAsync(accessToken, "P2");
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(property1, accessToken, categoryId: categoryId);
        var workOrder2 = await CreateWorkOrderAsync(property2, accessToken);

        var response = await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 50m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "mismatch",
                WorkOrderId = (Guid?)workOrder2,
                PropertyId = (Guid?)null
            },
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("same property");
    }

    [Fact]
    public async Task UpdateExpense_ValidationErrors_Return400()
    {
        var email = $"put-validation-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId);

        // Amount: 0
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 0m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = categoryId, Description = "x" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Amount: -1
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = -1m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = categoryId, Description = "x" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Amount over max
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 10000000m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = categoryId, Description = "x" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Too many decimals
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 1.234m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = categoryId, Description = "x" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Future date
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 10m, Date = DateOnly.FromDateTime(DateTime.Today.AddDays(1)), CategoryId = categoryId, Description = "x" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Empty category
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 10m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = Guid.Empty, Description = "x" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Description over 500
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 10m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = categoryId, Description = new string('x', 501) },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Description with HTML
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new { Amount = 10m, Date = DateOnly.FromDateTime(DateTime.Today), CategoryId = categoryId, Description = "<b>bold</b>" },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Empty WorkOrderId (non-null)
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 10m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "x",
                WorkOrderId = (Guid?)Guid.Empty,
                PropertyId = (Guid?)null
            },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Empty PropertyId (non-null)
        (await PutAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}",
            new
            {
                Amount = 10m,
                Date = DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId,
                Description = "x",
                WorkOrderId = (Guid?)null,
                PropertyId = (Guid?)Guid.Empty
            },
            accessToken)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    // =====================================================
    // DELETE /api/v1/expenses/{id} (Soft Delete) — preserved from ExpensesControllerDeleteTests.cs
    // =====================================================

    #region DELETE /expenses/{id}

    [Fact]
    public async Task DeleteExpense_WithoutAuth_Returns401()
    {
        var response = await _client.DeleteAsync($"/api/v1/expenses/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteExpense_ValidExpense_Returns204()
    {
        var email = $"delete-expense-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteExpense_ValidExpense_SetsDeletedAt()
    {
        var email = $"delete-timestamp-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        var beforeDelete = DateTime.UtcNow;
        await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        var afterDelete = DateTime.UtcNow;

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var expense = await dbContext.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == expenseId);

        expense.Should().NotBeNull();
        expense!.DeletedAt.Should().NotBeNull();
        expense.DeletedAt.Should().BeAfter(beforeDelete.AddSeconds(-1));
        expense.DeletedAt.Should().BeBefore(afterDelete.AddSeconds(1));
    }

    [Fact]
    public async Task DeleteExpense_NonExistentExpense_Returns404()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{Guid.NewGuid()}", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteExpense_OtherAccountExpense_Returns404()
    {
        var email1 = $"user1-expense-{Guid.NewGuid():N}@example.com";
        var email2 = $"user2-expense-{Guid.NewGuid():N}@example.com";
        var (accessToken1, _) = await RegisterAndLoginAsync(email1);
        var (accessToken2, _) = await RegisterAndLoginAsync(email2);

        var propertyId = await CreatePropertyAsync(accessToken1);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken1);

        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken2);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteExpense_AlreadyDeleted_Returns404()
    {
        var email = $"delete-twice-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteExpense_ExcludedFromGetByProperty()
    {
        var email = $"delete-list-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var propertyId = await CreatePropertyAsync(accessToken);

        var expenseId1 = await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Expense to Keep");
        var expenseId2 = await CreateExpenseAsync(propertyId, accessToken, 50.00m, "Expense to Delete");

        await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId2}", accessToken);

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/expenses", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Id.Should().Be(expenseId1);
        content.Items[0].Description.Should().Be("Expense to Keep");
        content.YtdTotal.Should().Be(100.00m);
    }

    [Fact]
    public async Task DeleteExpense_GetByIdReturns404()
    {
        var email = $"delete-getbyid-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);

        var response = await GetWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    // =====================================================
    // GET /api/v1/expenses — preserved + new (sort/filter/pagination extras)
    // =====================================================

    #region GET /expenses

    [Fact]
    public async Task GetAllExpenses_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/expenses");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAllExpenses_NoExpenses_ReturnsEmptyList()
    {
        var accessToken = await GetAccessTokenAsync();

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
        content.Page.Should().Be(1);
        content.PageSize.Should().Be(50);
        content.TotalPages.Should().Be(0);
    }

    [Fact]
    public async Task GetAllExpenses_WithExpenses_ReturnsPaginated()
    {
        var email = $"getall-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Expense One");
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "Expense Two");
        await CreateExpenseAsync(propertyId, accessToken, 300.00m, "Expense Three");

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(3);
        content.TotalCount.Should().Be(3);
        content.Page.Should().Be(1);
        content.TotalPages.Should().Be(1);
    }

    [Fact]
    public async Task GetAllExpenses_IncludesPropertyName()
    {
        var email = $"property-name-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken, "My Test Property");
        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Test Expense");

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].PropertyName.Should().Be("My Test Property");
    }

    [Fact]
    public async Task GetAllExpenses_SortedByDateDescending()
    {
        var email = $"sorted-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Oldest", DateOnly.FromDateTime(DateTime.Today.AddDays(-30)));
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "Newest", DateOnly.FromDateTime(DateTime.Today));
        await CreateExpenseAsync(propertyId, accessToken, 150.00m, "Middle", DateOnly.FromDateTime(DateTime.Today.AddDays(-15)));

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(3);
        content.Items[0].Description.Should().Be("Newest");
        content.Items[1].Description.Should().Be("Middle");
        content.Items[2].Description.Should().Be("Oldest");
    }

    [Fact]
    public async Task GetAllExpenses_WithPageSize_RespectsPageSize()
    {
        var email = $"pagesize-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        for (int i = 0; i < 5; i++)
        {
            await CreateExpenseAsync(propertyId, accessToken, 100.00m + i, $"Expense {i}");
        }

        var response = await GetWithAuthAsync("/api/v1/expenses?pageSize=2", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(2);
        content.TotalCount.Should().Be(5);
        content.PageSize.Should().Be(2);
        content.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task GetAllExpenses_WithPage_ReturnsCorrectPage()
    {
        var email = $"pagination-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        for (int i = 0; i < 5; i++)
        {
            await CreateExpenseAsync(propertyId, accessToken, 100.00m + i, $"Expense {i}");
        }

        var response = await GetWithAuthAsync("/api/v1/expenses?pageSize=2&page=2", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(2);
        content.Page.Should().Be(2);
    }

    [Fact]
    public async Task GetAllExpenses_WithYearFilter_ReturnsMatchingYear()
    {
        var email = $"year-filter-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "2025 Expense", new DateOnly(2025, 6, 15));
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "2024 Expense", new DateOnly(2024, 6, 15));

        var response = await GetWithAuthAsync("/api/v1/expenses?year=2025", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("2025 Expense");
    }

    [Fact]
    public async Task GetAllExpenses_WithDateRange_ReturnsMatchingDates()
    {
        var email = $"date-range-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Before", new DateOnly(2024, 1, 1));
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "In Range", new DateOnly(2024, 6, 15));
        await CreateExpenseAsync(propertyId, accessToken, 300.00m, "After", new DateOnly(2024, 11, 30));

        var response = await GetWithAuthAsync("/api/v1/expenses?dateFrom=2024-06-01&dateTo=2024-06-30", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("In Range");
    }

    [Fact]
    public async Task GetAllExpenses_WithCategoryFilter_ReturnsMatchingCategory()
    {
        var email = $"category-filter-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var categoriesResponse = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
        var categories = await categoriesResponse.Content.ReadFromJsonAsync<ExpenseCategoriesResponse>();
        var repairsCategory = categories!.Items.First(c => c.Name == "Repairs");
        var utilitiesCategory = categories!.Items.First(c => c.Name == "Utilities");

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Repairs Expense", categoryId: repairsCategory.Id);
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "Utilities Expense", categoryId: utilitiesCategory.Id);

        var response = await GetWithAuthAsync($"/api/v1/expenses?categoryIds={repairsCategory.Id}", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("Repairs Expense");
    }

    [Fact]
    public async Task GetAllExpenses_WithSearchFilter_ReturnsMatchingDescription()
    {
        var email = $"search-filter-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Plumbing repair in bathroom");
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "Electrical work");

        var response = await GetWithAuthAsync("/api/v1/expenses?search=plumbing", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Contain("Plumbing");
    }

    [Fact]
    public async Task GetAllExpenses_SearchFilter_CaseInsensitive()
    {
        var email = $"search-case-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Plumbing repair");

        var response = await GetWithAuthAsync("/api/v1/expenses?search=PLUMBING", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllExpenses_MultipleFilters_ReturnsIntersection()
    {
        var email = $"multi-filter-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Plumbing Q1", new DateOnly(2025, 2, 15));
        await CreateExpenseAsync(propertyId, accessToken, 200.00m, "Plumbing Q4", new DateOnly(2025, 11, 15));
        await CreateExpenseAsync(propertyId, accessToken, 300.00m, "Electrical Q1", new DateOnly(2025, 3, 15));

        var response = await GetWithAuthAsync(
            "/api/v1/expenses?search=plumbing&dateFrom=2025-01-01&dateTo=2025-03-31",
            accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(1);
        content.Items[0].Description.Should().Be("Plumbing Q1");
    }

    [Fact]
    public async Task GetAllExpenses_NoMatches_ReturnsEmptyList()
    {
        var email = $"no-matches-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100.00m, "Plumbing repair");

        var response = await GetWithAuthAsync("/api/v1/expenses?search=nonexistent", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllExpenses_MultipleProperties_ReturnsAll()
    {
        var email = $"multi-property-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var property1 = await CreatePropertyAsync(accessToken, "Property One");
        var property2 = await CreatePropertyAsync(accessToken, "Property Two");

        await CreateExpenseAsync(property1, accessToken, 100.00m, "Expense Property 1");
        await CreateExpenseAsync(property2, accessToken, 200.00m, "Expense Property 2");

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(2);
        content.Items.Select(i => i.PropertyName).Should().Contain("Property One");
        content.Items.Select(i => i.PropertyName).Should().Contain("Property Two");
    }

    [Fact]
    public async Task GetAllExpenses_OtherUserExpenses_NotVisible()
    {
        var email1 = $"user1-{Guid.NewGuid():N}@example.com";
        var email2 = $"user2-{Guid.NewGuid():N}@example.com";
        var (accessToken1, _) = await RegisterAndLoginAsync(email1);
        var (accessToken2, _) = await RegisterAndLoginAsync(email2);

        var property1 = await CreatePropertyAsync(accessToken1);
        await CreateExpenseAsync(property1, accessToken1, 100.00m, "User 1 Expense");

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken2);

        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().BeEmpty();
    }

    // ----- New (AC-GET-ALL-NEW-*) -----

    [Fact]
    public async Task GetAllExpenses_SortByAmountDescending_ReturnsOrdered()
    {
        var email = $"sort-amt-desc-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        await CreateExpenseAsync(propertyId, accessToken, 100m, "one");
        await CreateExpenseAsync(propertyId, accessToken, 200m, "two");
        await CreateExpenseAsync(propertyId, accessToken, 300m, "three");

        var response = await GetWithAuthAsync("/api/v1/expenses?sortBy=amount&sortDirection=desc", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(3);
        content.Items[0].Amount.Should().Be(300m);
        content.Items[1].Amount.Should().Be(200m);
        content.Items[2].Amount.Should().Be(100m);
    }

    [Fact]
    public async Task GetAllExpenses_SortByAmountAscending_ReturnsOrdered()
    {
        var email = $"sort-amt-asc-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        await CreateExpenseAsync(propertyId, accessToken, 100m, "one");
        await CreateExpenseAsync(propertyId, accessToken, 200m, "two");
        await CreateExpenseAsync(propertyId, accessToken, 300m, "three");

        var response = await GetWithAuthAsync("/api/v1/expenses?sortBy=amount&sortDirection=asc", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items[0].Amount.Should().Be(100m);
        content.Items[1].Amount.Should().Be(200m);
        content.Items[2].Amount.Should().Be(300m);
    }

    [Fact]
    public async Task GetAllExpenses_PropertyIdFilter_ReturnsMatching()
    {
        var email = $"prop-filter-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var property1 = await CreatePropertyAsync(accessToken, "P1");
        var property2 = await CreatePropertyAsync(accessToken, "P2");
        await CreateExpenseAsync(property1, accessToken, 10m, "P1-1");
        await CreateExpenseAsync(property1, accessToken, 20m, "P1-2");
        await CreateExpenseAsync(property2, accessToken, 30m, "P2-1");

        var response = await GetWithAuthAsync($"/api/v1/expenses?propertyId={property1}", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(2);
        content.Items.Should().OnlyContain(i => i.PropertyId == property1);
    }

    [Fact]
    public async Task GetAllExpenses_MultipleCategoryIds_ReturnsUnion()
    {
        var email = $"multi-cat-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var categoriesResponse = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
        var categories = await categoriesResponse.Content.ReadFromJsonAsync<ExpenseCategoriesResponse>();
        var repairs = categories!.Items.First(c => c.Name == "Repairs");
        var utilities = categories!.Items.First(c => c.Name == "Utilities");
        var insurance = categories!.Items.First(c => c.Name == "Insurance");

        await CreateExpenseAsync(propertyId, accessToken, 10m, "rep", categoryId: repairs.Id);
        await CreateExpenseAsync(propertyId, accessToken, 20m, "util", categoryId: utilities.Id);
        await CreateExpenseAsync(propertyId, accessToken, 30m, "ins", categoryId: insurance.Id);

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses?categoryIds={repairs.Id}&categoryIds={utilities.Id}",
            accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().HaveCount(2);
        content.Items.Should().OnlyContain(i => i.CategoryId == repairs.Id || i.CategoryId == utilities.Id);
    }

    [Fact]
    public async Task GetAllExpenses_PageBeyondLast_ReturnsEmptyItems()
    {
        var email = $"page-beyond-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        await CreateExpenseAsync(propertyId, accessToken, 1m, "a");
        await CreateExpenseAsync(propertyId, accessToken, 2m, "b");
        await CreateExpenseAsync(propertyId, accessToken, 3m, "c");

        var response = await GetWithAuthAsync("/api/v1/expenses?page=10&pageSize=50", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.Items.Should().BeEmpty();
        content.Page.Should().Be(10);
        content.TotalCount.Should().Be(3);
        content.TotalPages.Should().Be(1);
    }

    [Fact]
    public async Task GetAllExpenses_PageSizeOverMax_ClampedTo100()
    {
        var accessToken = await GetAccessTokenAsync();

        var response = await GetWithAuthAsync("/api/v1/expenses?pageSize=500", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task GetAllExpenses_TotalAmountReturnedAccurately()
    {
        var email = $"total-amt-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        await CreateExpenseAsync(propertyId, accessToken, 100m, "a");
        await CreateExpenseAsync(propertyId, accessToken, 200m, "b");
        await CreateExpenseAsync(propertyId, accessToken, 300m, "c");

        var response = await GetWithAuthAsync("/api/v1/expenses", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListResponse>();
        content!.TotalAmount.Should().Be(600.00m);
    }

    #endregion

    // =====================================================
    // GET /api/v1/expenses/{id} — AC-GETBYID-*
    // =====================================================

    #region GET /expenses/{id}

    [Fact]
    public async Task GetExpenseById_AsOwner_Returns200_WithFullDto()
    {
        var email = $"getbyid-ok-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken, "Alpha");
        var categoryId = await GetCategoryIdByNameAsync(accessToken, "Repairs");
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, 42.00m, "faucet", new DateOnly(2025, 7, 1), categoryId);

        var response = await GetWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ExpenseDetailResponse>();
        dto.Should().NotBeNull();
        dto!.Id.Should().Be(expenseId);
        dto.PropertyId.Should().Be(propertyId);
        dto.PropertyName.Should().Be("Alpha");
        dto.CategoryId.Should().Be(categoryId);
        dto.CategoryName.Should().Be("Repairs");
        dto.ScheduleELine.Should().Be("Line 14");
        dto.Amount.Should().Be(42.00m);
        dto.Date.Should().Be(new DateOnly(2025, 7, 1));
        dto.Description.Should().Be("faucet");
        dto.ReceiptId.Should().BeNull();
        dto.WorkOrderId.Should().BeNull();
        dto.WorkOrderDescription.Should().BeNull();
        dto.WorkOrderStatus.Should().BeNull();
    }

    [Fact]
    public async Task GetExpenseById_WithWorkOrder_IncludesWorkOrderFields()
    {
        var email = $"getbyid-wo-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var categoryId = await GetFirstCategoryIdAsync(accessToken);
        var workOrderId = await CreateWorkOrderAsync(propertyId, accessToken, "Test work order");
        var expenseId = await CreateExpenseAsync(propertyId, accessToken, categoryId: categoryId, workOrderId: workOrderId);

        var response = await GetWithAuthAsync($"/api/v1/expenses/{expenseId}", accessToken);
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<ExpenseDetailResponse>();
        dto!.WorkOrderId.Should().Be(workOrderId);
        dto.WorkOrderDescription.Should().Be("Test work order");
        dto.WorkOrderStatus.Should().Be(WorkOrderStatus.Reported.ToString());
    }

    [Fact]
    public async Task GetExpenseById_NonExistent_Returns404()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await GetWithAuthAsync($"/api/v1/expenses/{Guid.NewGuid()}", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetExpenseById_CrossAccount_Returns404()
    {
        var emailA = $"getbyid-x-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"getbyid-x-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, _) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);
        var propertyA = await CreatePropertyAsync(tokenA);
        var expenseA = await CreateExpenseAsync(propertyA, tokenA);

        var response = await GetWithAuthAsync($"/api/v1/expenses/{expenseA}", tokenB);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    // =====================================================
    // GET /api/v1/properties/{id}/expenses — AC-PROP-*
    // =====================================================

    #region GET /properties/{id}/expenses

    [Fact]
    public async Task GetExpensesByProperty_ReturnsPagedWithYtdTotal_OrderedByDateDesc()
    {
        var email = $"byprop-ok-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var property1 = await CreatePropertyAsync(accessToken, "P1");
        var property2 = await CreatePropertyAsync(accessToken, "P2");

        await CreateExpenseAsync(property1, accessToken, 100m, "Oldest", new DateOnly(2025, 1, 1));
        await CreateExpenseAsync(property1, accessToken, 200m, "Middle", new DateOnly(2025, 5, 1));
        await CreateExpenseAsync(property1, accessToken, 300m, "Newest", new DateOnly(2025, 9, 1));
        // Expense on another property should not appear
        await CreateExpenseAsync(property2, accessToken, 999m, "Other property");

        var response = await GetWithAuthAsync($"/api/v1/properties/{property1}/expenses", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content.Should().NotBeNull();
        content!.Items.Should().HaveCount(3);
        content.TotalCount.Should().Be(3);
        content.YtdTotal.Should().Be(600.00m);
        content.PageSize.Should().Be(25);
        content.Items[0].Description.Should().Be("Newest");
        content.Items[1].Description.Should().Be("Middle");
        content.Items[2].Description.Should().Be("Oldest");
        content.Items.Should().OnlyContain(i => i.PropertyId == property1);
    }

    [Fact]
    public async Task GetExpensesByProperty_YearFilter_ReturnsMatching()
    {
        var email = $"byprop-year-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100m, "2024", new DateOnly(2024, 3, 15));
        await CreateExpenseAsync(propertyId, accessToken, 200m, "2025-a", new DateOnly(2025, 3, 15));
        await CreateExpenseAsync(propertyId, accessToken, 300m, "2025-b", new DateOnly(2025, 6, 15));

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/expenses?year=2025", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content!.Items.Should().HaveCount(2);
        content.YtdTotal.Should().Be(500m);
        content.Items.Should().OnlyContain(i => i.Date.Year == 2025);
    }

    [Fact]
    public async Task GetExpensesByProperty_NonExistentProperty_Returns404()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await GetWithAuthAsync($"/api/v1/properties/{Guid.NewGuid()}/expenses", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetExpensesByProperty_CrossAccountProperty_Returns404()
    {
        var emailA = $"byprop-x-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"byprop-x-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, _) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);
        var propertyA = await CreatePropertyAsync(tokenA);

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyA}/expenses", tokenB);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetExpensesByProperty_EmptyProperty_ReturnsZeroYtdTotal()
    {
        var email = $"byprop-empty-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/expenses", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content!.Items.Should().BeEmpty();
        content.TotalCount.Should().Be(0);
        content.YtdTotal.Should().Be(0);
        content.TotalPages.Should().Be(1);
    }

    [Fact]
    public async Task GetExpensesByProperty_Pagination_Page2PageSize2()
    {
        var email = $"byprop-page2-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        for (int i = 0; i < 5; i++)
        {
            await CreateExpenseAsync(propertyId, accessToken, 10m + i, $"e{i}", DateOnly.FromDateTime(DateTime.Today.AddDays(-i)));
        }

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/expenses?pageSize=2&page=2", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content!.Items.Should().HaveCount(2);
        content.Page.Should().Be(2);
        content.PageSize.Should().Be(2);
        content.TotalPages.Should().Be(3);
        content.YtdTotal.Should().Be(60m); // 10+11+12+13+14 = 60, independent of pagination
    }

    [Fact]
    public async Task GetExpensesByProperty_PageSizeOverMax_ClampedTo100()
    {
        var email = $"byprop-clamp-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/expenses?pageSize=500", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content!.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task GetExpensesByProperty_PageSizeZero_Clamped()
    {
        var email = $"byprop-zero-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var response = await GetWithAuthAsync($"/api/v1/properties/{propertyId}/expenses?pageSize=0", accessToken);
        var content = await response.Content.ReadFromJsonAsync<PagedExpenseListDto>();
        content!.PageSize.Should().Be(1); // Math.Clamp(0, 1, 100) == 1
    }

    #endregion

    // =====================================================
    // POST /api/v1/expenses/{id}/link-receipt — AC-LINK-*
    // =====================================================

    #region POST /expenses/{id}/link-receipt

    [Fact]
    public async Task LinkReceipt_HappyPath_Returns204_AndSetsBothFkSides_AndProcessedAt()
    {
        var email = $"link-ok-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);
        var receiptId = await SeedReceiptAsync(accountId, userId, propertyId: propertyId);

        var before = DateTime.UtcNow.AddSeconds(-2);
        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = receiptId },
            accessToken);
        var after = DateTime.UtcNow.AddSeconds(2);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var expense = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
        var receipt = await dbContext.Receipts.IgnoreQueryFilters().FirstAsync(r => r.Id == receiptId);
        expense.ReceiptId.Should().Be(receiptId);
        receipt.ExpenseId.Should().Be(expenseId);
        receipt.ProcessedAt.Should().NotBeNull();
        receipt.ProcessedAt!.Value.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task LinkReceipt_ReceiptHadNullPropertyId_InheritsExpensePropertyId()
    {
        var email = $"link-inherit-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);
        var receiptId = await SeedReceiptAsync(accountId, userId, propertyId: null);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = receiptId },
            accessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var receipt = await dbContext.Receipts.IgnoreQueryFilters().FirstAsync(r => r.Id == receiptId);
        receipt.PropertyId.Should().Be(propertyId);
    }

    [Fact]
    public async Task LinkReceipt_ReceiptAlreadyHadPropertyId_Unchanged()
    {
        var email = $"link-keep-prop-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var property1 = await CreatePropertyAsync(accessToken, "P1");
        var property2 = await CreatePropertyAsync(accessToken, "P2");
        var expenseId = await CreateExpenseAsync(property1, accessToken);
        // Receipt already tied to P2
        var receiptId = await SeedReceiptAsync(accountId, userId, propertyId: property2);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = receiptId },
            accessToken);
        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var receipt = await dbContext.Receipts.IgnoreQueryFilters().FirstAsync(r => r.Id == receiptId);
        receipt.PropertyId.Should().Be(property2);
    }

    [Fact]
    public async Task LinkReceipt_EmptyReceiptId_Returns400()
    {
        var email = $"link-empty-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = Guid.Empty },
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task LinkReceipt_NonExistentExpense_Returns404()
    {
        var email = $"link-ghost-exp-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var receiptId = await SeedReceiptAsync(accountId, userId);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{Guid.NewGuid()}/link-receipt",
            new { ReceiptId = receiptId },
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task LinkReceipt_CrossAccountExpense_Returns404()
    {
        var emailA = $"link-x-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"link-x-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, userA) = await RegisterAndLoginAsync(emailA);
        var (tokenB, userB) = await RegisterAndLoginAsync(emailB);
        var acctB = await GetAccountIdForUserAsync(userB);

        var propertyA = await CreatePropertyAsync(tokenA);
        var expenseA = await CreateExpenseAsync(propertyA, tokenA);
        var receiptB = await SeedReceiptAsync(acctB, userB);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseA}/link-receipt",
            new { ReceiptId = receiptB },
            tokenB);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task LinkReceipt_NonExistentReceipt_Returns404()
    {
        var email = $"link-ghost-rec-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = Guid.NewGuid() },
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task LinkReceipt_ExpenseAlreadyHasReceipt_Returns409()
    {
        var email = $"link-conflict-exp-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);
        var firstReceipt = await SeedReceiptAsync(accountId, userId, propertyId: propertyId);
        await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = firstReceipt },
            accessToken);

        var secondReceipt = await SeedReceiptAsync(accountId, userId, propertyId: propertyId);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = secondReceipt },
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task LinkReceipt_ReceiptAlreadyProcessed_Returns409()
    {
        var email = $"link-conflict-rec-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);
        var processed = await SeedReceiptAsync(accountId, userId, propertyId: propertyId, processedAt: DateTime.UtcNow);

        var response = await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = processed },
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    #endregion

    // =====================================================
    // DELETE /api/v1/expenses/{id}/receipt — AC-UNLINK-*
    // =====================================================

    #region DELETE /expenses/{id}/receipt

    [Fact]
    public async Task UnlinkReceipt_HappyPath_Returns204_AndClearsBothSides_AndClearsProcessedAt()
    {
        var email = $"unlink-ok-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);
        var receiptId = await SeedReceiptAsync(accountId, userId, propertyId: propertyId);
        await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = receiptId },
            accessToken);

        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}/receipt", accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var expense = await dbContext.Expenses.IgnoreQueryFilters().FirstAsync(e => e.Id == expenseId);
        var receipt = await dbContext.Receipts.IgnoreQueryFilters().FirstAsync(r => r.Id == receiptId);
        expense.ReceiptId.Should().BeNull();
        receipt.ExpenseId.Should().BeNull();
        receipt.ProcessedAt.Should().BeNull();
    }

    [Fact]
    public async Task UnlinkReceipt_NonExistentExpense_Returns404()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{Guid.NewGuid()}/receipt", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UnlinkReceipt_ExpenseHasNoReceipt_Returns404()
    {
        var email = $"unlink-no-rec-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);

        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}/receipt", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UnlinkReceipt_CrossAccountExpense_Returns404()
    {
        var emailA = $"unlink-x-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"unlink-x-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, userA) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);
        var acctA = await GetAccountIdForUserAsync(userA);

        var propertyA = await CreatePropertyAsync(tokenA);
        var expenseA = await CreateExpenseAsync(propertyA, tokenA);
        var receiptA = await SeedReceiptAsync(acctA, userA, propertyId: propertyA);
        await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseA}/link-receipt",
            new { ReceiptId = receiptA },
            tokenA);

        var response = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseA}/receipt", tokenB);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UnlinkReceipt_DoubleCall_ReturnsSecond404()
    {
        var email = $"unlink-twice-{Guid.NewGuid():N}@example.com";
        var (accessToken, userId) = await RegisterAndLoginAsync(email);
        var accountId = await GetAccountIdForUserAsync(userId);
        var propertyId = await CreatePropertyAsync(accessToken);
        var expenseId = await CreateExpenseAsync(propertyId, accessToken);
        var receiptId = await SeedReceiptAsync(accountId, userId, propertyId: propertyId);
        await PostAsJsonWithAuthAsync(
            $"/api/v1/expenses/{expenseId}/link-receipt",
            new { ReceiptId = receiptId },
            accessToken);

        var first = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}/receipt", accessToken);
        first.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var second = await DeleteWithAuthAsync($"/api/v1/expenses/{expenseId}/receipt", accessToken);
        second.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    // =====================================================
    // GET /api/v1/expenses/check-duplicate — preserved
    // =====================================================

    #region GET /expenses/check-duplicate

    [Fact]
    public async Task CheckDuplicate_WithoutAuth_Returns401()
    {
        var response = await _client.GetAsync(
            "/api/v1/expenses/check-duplicate?propertyId=00000000-0000-0000-0000-000000000001&amount=100&date=2024-12-01");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CheckDuplicate_MissingPropertyId_Returns400()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await GetWithAuthAsync(
            "/api/v1/expenses/check-duplicate?amount=100&date=2024-12-01",
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CheckDuplicate_MissingAmount_Returns400()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={Guid.NewGuid()}&date=2024-12-01",
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CheckDuplicate_MissingDate_Returns400()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={Guid.NewGuid()}&amount=100",
            accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CheckDuplicate_MissingAllParams_Returns400()
    {
        var accessToken = await GetAccessTokenAsync();
        var response = await GetWithAuthAsync("/api/v1/expenses/check-duplicate", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CheckDuplicate_DuplicateFound_ReturnsIsDuplicateTrue()
    {
        var email = $"dup-found-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 127.50m, "Home Depot - Faucet", new DateOnly(2024, 12, 1));

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={propertyId}&amount=127.50&date=2024-12-01",
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content.Should().NotBeNull();
        content!.IsDuplicate.Should().BeTrue();
        content.ExistingExpense.Should().NotBeNull();
        content.ExistingExpense!.Amount.Should().Be(127.50m);
        content.ExistingExpense.Description.Should().Be("Home Depot - Faucet");
    }

    [Fact]
    public async Task CheckDuplicate_NoDuplicate_ReturnsIsDuplicateFalse()
    {
        var email = $"no-dup-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={propertyId}&amount=100&date=2024-12-01",
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content!.IsDuplicate.Should().BeFalse();
        content.ExistingExpense.Should().BeNull();
    }

    [Fact]
    public async Task CheckDuplicate_DateWithin24Hours_ReturnsDuplicate()
    {
        var email = $"date-24hr-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100m, "Original", new DateOnly(2024, 12, 1));

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={propertyId}&amount=100&date=2024-12-02",
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content!.IsDuplicate.Should().BeTrue();
    }

    [Fact]
    public async Task CheckDuplicate_DateMoreThan24HoursApart_ReturnsNoDuplicate()
    {
        var email = $"date-far-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);

        await CreateExpenseAsync(propertyId, accessToken, 100m, "Original", new DateOnly(2024, 12, 1));

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={propertyId}&amount=100&date=2024-12-03",
            accessToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content!.IsDuplicate.Should().BeFalse();
    }

    [Fact]
    public async Task CheckDuplicate_DifferentAmount_ReturnsNoDuplicate()
    {
        var email = $"diff-amount-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var propertyId = await CreatePropertyAsync(accessToken);
        await CreateExpenseAsync(propertyId, accessToken, 100m, "Original", new DateOnly(2024, 12, 1));

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={propertyId}&amount=150&date=2024-12-01",
            accessToken);
        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content!.IsDuplicate.Should().BeFalse();
    }

    [Fact]
    public async Task CheckDuplicate_DifferentProperty_ReturnsNoDuplicate()
    {
        var email = $"diff-prop-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var property1 = await CreatePropertyAsync(accessToken, "Property One");
        var property2 = await CreatePropertyAsync(accessToken, "Property Two");

        await CreateExpenseAsync(property1, accessToken, 100m, "Original", new DateOnly(2024, 12, 1));

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={property2}&amount=100&date=2024-12-01",
            accessToken);
        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content!.IsDuplicate.Should().BeFalse();
    }

    [Fact]
    public async Task CheckDuplicate_OtherUserExpense_NotDetected()
    {
        var email1 = $"dup-user1-{Guid.NewGuid():N}@example.com";
        var email2 = $"dup-user2-{Guid.NewGuid():N}@example.com";
        var (accessToken1, _) = await RegisterAndLoginAsync(email1);
        var (accessToken2, _) = await RegisterAndLoginAsync(email2);

        var property1 = await CreatePropertyAsync(accessToken1);
        await CreateExpenseAsync(property1, accessToken1, 100m, "User 1 Expense", new DateOnly(2024, 12, 1));

        var property2 = await CreatePropertyAsync(accessToken2);

        var response = await GetWithAuthAsync(
            $"/api/v1/expenses/check-duplicate?propertyId={property2}&amount=100&date=2024-12-01",
            accessToken2);

        var content = await response.Content.ReadFromJsonAsync<DuplicateCheckResponse>();
        content!.IsDuplicate.Should().BeFalse();
    }

    #endregion

    // =====================================================
    // GET /api/v1/expenses/totals — AC-TOTALS-*
    // =====================================================

    #region GET /expenses/totals

    [Fact]
    public async Task GetExpenseTotals_WithYear_ReturnsTotals_AndByPropertyBreakdown()
    {
        var email = $"totals-ok-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);
        var p1 = await CreatePropertyAsync(accessToken, "P1");
        var p2 = await CreatePropertyAsync(accessToken, "P2");

        await CreateExpenseAsync(p1, accessToken, 100m, "p1-a", new DateOnly(2025, 3, 1));
        await CreateExpenseAsync(p1, accessToken, 200m, "p1-b", new DateOnly(2025, 4, 1));
        await CreateExpenseAsync(p2, accessToken, 50m, "p2-a", new DateOnly(2025, 5, 1));

        var response = await GetWithAuthAsync("/api/v1/expenses/totals?year=2025", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<ExpenseTotalsResponse>();
        content.Should().NotBeNull();
        content!.TotalExpenses.Should().Be(350m);
        content.Year.Should().Be(2025);
        content.ByProperty.Should().HaveCount(2);
        content.ByProperty.Sum(x => x.Total).Should().Be(350m);
    }

    [Fact]
    public async Task GetExpenseTotals_NoYear_DefaultsToCurrentYear()
    {
        var email = $"totals-noyear-{Guid.NewGuid():N}@example.com";
        var (accessToken, _) = await RegisterAndLoginAsync(email);

        var response = await GetWithAuthAsync("/api/v1/expenses/totals", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<ExpenseTotalsResponse>();
        content!.Year.Should().Be(DateTime.UtcNow.Year);
    }

    [Fact]
    public async Task GetExpenseTotals_EmptyAccount_ReturnsZero()
    {
        var accessToken = await GetAccessTokenAsync();

        var response = await GetWithAuthAsync("/api/v1/expenses/totals?year=2025", accessToken);
        var content = await response.Content.ReadFromJsonAsync<ExpenseTotalsResponse>();
        content!.TotalExpenses.Should().Be(0);
        content.ByProperty.Should().BeEmpty();
    }

    [Fact]
    public async Task GetExpenseTotals_CrossAccount_DoesNotLeak()
    {
        var emailA = $"totals-x-a-{Guid.NewGuid():N}@example.com";
        var emailB = $"totals-x-b-{Guid.NewGuid():N}@example.com";
        var (tokenA, _) = await RegisterAndLoginAsync(emailA);
        var (tokenB, _) = await RegisterAndLoginAsync(emailB);
        var propertyB = await CreatePropertyAsync(tokenB);
        await CreateExpenseAsync(propertyB, tokenB, 500m, "B-1", new DateOnly(2025, 6, 1));

        var response = await GetWithAuthAsync("/api/v1/expenses/totals?year=2025", tokenA);
        var content = await response.Content.ReadFromJsonAsync<ExpenseTotalsResponse>();
        content!.TotalExpenses.Should().Be(0);
    }

    #endregion

    // =====================================================
    // GET /api/v1/expense-categories — AC-CATS-1
    // =====================================================

    #region GET /expense-categories

    [Fact]
    public async Task GetExpenseCategories_Returns200_WithAllSeededCategories()
    {
        var accessToken = await GetAccessTokenAsync();

        var response = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<ExpenseCategoriesResponse>();
        content.Should().NotBeNull();
        // Confirmed against the seed migration: 15 IRS Schedule E categories.
        content!.Items.Should().HaveCount(15);
        content.TotalCount.Should().Be(content.Items.Count);
        content.Items.Should().Contain(c => c.Name == "Repairs");
        content.Items.Should().Contain(c => c.Name == "Utilities");
    }

    #endregion

    // =====================================================
    // Shared helpers
    // =====================================================

    #region Helpers

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

    private async Task<(string AccessToken, Guid? UserId)> LoginAsync(string email, string password = "Test@123456")
    {
        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.EnsureSuccessStatusCode();
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        return (loginContent!.AccessToken, null);
    }

    private async Task<Guid> CreatePropertyAsync(string accessToken, string name = "Test Property")
    {
        var createRequest = new
        {
            Name = name,
            Street = "123 Test Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var response = await PostAsJsonWithAuthAsync("/api/v1/properties", createRequest, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreatePropertyResponse>();
        return content!.Id;
    }

    private async Task<Guid> CreateExpenseAsync(
        Guid propertyId,
        string accessToken,
        decimal amount = 100.00m,
        string description = "Test Expense",
        DateOnly? date = null,
        Guid? categoryId = null,
        Guid? workOrderId = null)
    {
        if (categoryId == null)
        {
            categoryId = await GetFirstCategoryIdAsync(accessToken);
        }

        object body = workOrderId.HasValue
            ? new
            {
                PropertyId = propertyId,
                Amount = amount,
                Date = date ?? DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId.Value,
                Description = description,
                WorkOrderId = workOrderId.Value
            }
            : new
            {
                PropertyId = propertyId,
                Amount = amount,
                Date = date ?? DateOnly.FromDateTime(DateTime.Today),
                CategoryId = categoryId.Value,
                Description = description
            };

        var response = await PostAsJsonWithAuthAsync("/api/v1/expenses", body, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateExpenseResponse>();
        return content!.Id;
    }

    private async Task<Guid> CreateWorkOrderAsync(Guid propertyId, string accessToken, string description = "Test work order")
    {
        var request = new { PropertyId = propertyId, Description = description };
        var response = await PostAsJsonWithAuthAsync("/api/v1/work-orders", request, accessToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<CreateWorkOrderResponse>();
        return content!.Id;
    }

    private async Task<Guid> GetFirstCategoryIdAsync(string accessToken)
    {
        var response = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
        response.EnsureSuccessStatusCode();
        var categories = await response.Content.ReadFromJsonAsync<ExpenseCategoriesResponse>();
        return categories!.Items[0].Id;
    }

    private async Task<Guid> GetCategoryIdByNameAsync(string accessToken, string name)
    {
        var response = await GetWithAuthAsync("/api/v1/expense-categories", accessToken);
        response.EnsureSuccessStatusCode();
        var categories = await response.Content.ReadFromJsonAsync<ExpenseCategoriesResponse>();
        return categories!.Items.First(c => c.Name == name).Id;
    }

    private async Task<Guid> GetAccountIdForUserAsync(Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await dbContext.Set<Infrastructure.Identity.ApplicationUser>()
            .IgnoreQueryFilters()
            .FirstAsync(u => u.Id == userId);
        return user.AccountId;
    }

    /// <summary>
    /// Seeds a Receipt row directly via AppDbContext. Receipts are created through an S3 upload
    /// flow in production — for integration tests we bypass the choreography.
    /// </summary>
    private async Task<Guid> SeedReceiptAsync(
        Guid accountId,
        Guid createdByUserId,
        Guid? propertyId = null,
        DateTime? processedAt = null,
        Guid? expenseId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var receipt = new Receipt
        {
            AccountId = accountId,
            PropertyId = propertyId,
            StorageKey = $"{accountId}/receipts/{Guid.NewGuid()}.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            CreatedByUserId = createdByUserId,
            ProcessedAt = processedAt,
            ExpenseId = expenseId,
        };
        dbContext.Receipts.Add(receipt);
        await dbContext.SaveChangesAsync();
        return receipt.Id;
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PutAsJsonWithAuthAsync<T>(string url, T content, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
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

    private async Task<HttpResponseMessage> DeleteWithAuthAsync(string url, string accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Add("Authorization", $"Bearer {accessToken}");
        return await _client.SendAsync(request);
    }

    #endregion
}

// =====================================================
// Response records scoped to this test file (file-local)
// =====================================================

file record CreateExpenseResponse(Guid Id);

file record ExpenseCategoriesResponse(List<ExpenseCategoryDto> Items, int TotalCount);

file record PagedExpenseListResponse(
    List<ExpenseListItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    decimal TotalAmount
);

file record DuplicateCheckResponse(
    bool IsDuplicate,
    DuplicateExpenseResponse? ExistingExpense
);

file record DuplicateExpenseResponse(
    Guid Id,
    DateOnly Date,
    decimal Amount,
    string? Description
);

file record ExpenseDetailResponse(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    Guid CategoryId,
    string CategoryName,
    string? ScheduleELine,
    decimal Amount,
    DateOnly Date,
    string? Description,
    Guid? ReceiptId,
    Guid? WorkOrderId,
    string? WorkOrderDescription,
    string? WorkOrderStatus,
    DateTime CreatedAt
);

file record ExpenseTotalsResponse(
    decimal TotalExpenses,
    int Year,
    List<ExpenseTotalsPropertyResponse> ByProperty
);

file record ExpenseTotalsPropertyResponse(
    Guid PropertyId,
    string PropertyName,
    decimal Total
);

file record CreateWorkOrderResponse(Guid Id);
