using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// ATDD RED Phase — Story 16.6, Task 5.4
///
/// Unit tests for TotalAmount in GetAllExpenses handler.
/// Will NOT COMPILE until TotalAmount is added to PagedResult (Task 5.1)
/// and SumAsync() is added to the handler (Task 5.2).
///
/// This is intentional — compilation failure IS the red state.
///
/// To reach GREEN:
/// 1. Add `decimal TotalAmount = 0` to PagedResult record (Task 5.1)
/// 2. Add `var totalAmount = await query.SumAsync(e => e.Amount, ct)` before pagination (Task 5.2)
/// 3. Pass TotalAmount in the return statement
/// </summary>
public class GetAllExpensesTotalAmountTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly GetAllExpensesHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _propertyId = Guid.NewGuid();
    private readonly Guid _categoryId = Guid.NewGuid();

    public GetAllExpensesTotalAmountTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _handler = new GetAllExpensesHandler(_dbContextMock.Object);
    }

    #region TotalAmount Tests (AC-2 Story 16.6, Task 5.4)

    [Fact]
    public async Task Handle_ReturnsCorrectTotalAmount_ForAllFilteredExpenses()
    {
        // GIVEN: Multiple expenses with known amounts
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 15)),
            CreateExpense(200m, new DateOnly(2026, 2, 15)),
            CreateExpense(300m, new DateOnly(2026, 3, 15)),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // WHEN: Getting all expenses
        var result = await _handler.Handle(query, CancellationToken.None);

        // THEN: TotalAmount is the sum of all filtered expenses (100 + 200 + 300 = 600)
        result.TotalAmount.Should().Be(600m);
        result.Items.Should().HaveCount(3);
    }

    [Fact]
    public async Task Handle_TotalAmountIsNotAffectedByPagination()
    {
        // GIVEN: 5 expenses totaling 500, but page size is only 2
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 1)),
            CreateExpense(100m, new DateOnly(2026, 2, 1)),
            CreateExpense(100m, new DateOnly(2026, 3, 1)),
            CreateExpense(100m, new DateOnly(2026, 4, 1)),
            CreateExpense(100m, new DateOnly(2026, 5, 1)),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 2);

        // WHEN: Getting first page of 2
        var result = await _handler.Handle(query, CancellationToken.None);

        // THEN: TotalAmount is across ALL pages (500), not just current page (200)
        result.TotalAmount.Should().Be(500m);
        result.Items.Should().HaveCount(2); // Only 2 items on this page
        result.TotalCount.Should().Be(5);   // But 5 total across all pages
    }

    [Fact]
    public async Task Handle_TotalAmountRespectsDateFilters()
    {
        // GIVEN: Expenses spanning Jan-Mar, filter to Jan-Feb only
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2025, 1, 15)),
            CreateExpense(200m, new DateOnly(2025, 2, 15)),
            CreateExpense(300m, new DateOnly(2025, 3, 15)),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: new DateOnly(2025, 1, 1),
            DateTo: new DateOnly(2025, 2, 28),
            CategoryIds: null, Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // WHEN: Filtering to Jan-Feb
        var result = await _handler.Handle(query, CancellationToken.None);

        // THEN: TotalAmount only includes Jan + Feb expenses (100 + 200 = 300)
        result.TotalAmount.Should().Be(300m);
        result.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_TotalAmountRespectsCategoryFilter()
    {
        // GIVEN: Expenses in two categories
        var repairsId = Guid.NewGuid();
        var utilitiesId = Guid.NewGuid();
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 15), repairsId, "Repairs"),
            CreateExpense(200m, new DateOnly(2026, 1, 16), repairsId, "Repairs"),
            CreateExpense(500m, new DateOnly(2026, 1, 17), utilitiesId, "Utilities"),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null,
            CategoryIds: new List<Guid> { repairsId },
            Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // WHEN: Filtering to Repairs category only
        var result = await _handler.Handle(query, CancellationToken.None);

        // THEN: TotalAmount only includes Repairs (100 + 200 = 300)
        result.TotalAmount.Should().Be(300m);
        result.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_TotalAmountIsZero_WhenNoExpensesMatch()
    {
        // GIVEN: No expenses
        SetupDbSet(new List<Expense>());

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // WHEN: Getting expenses
        var result = await _handler.Handle(query, CancellationToken.None);

        // THEN: TotalAmount is 0
        result.TotalAmount.Should().Be(0m);
        result.Items.Should().BeEmpty();
    }

    #endregion

    #region Helper Methods

    private Expense CreateExpense(
        decimal amount,
        DateOnly date,
        Guid? categoryId = null,
        string? categoryName = null)
    {
        var catId = categoryId ?? _categoryId;
        var catName = categoryName ?? "Test Category";

        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _propertyId,
            Property = new Property
            {
                Id = _propertyId,
                AccountId = _testAccountId,
                Name = "Test Property",
                Street = "123 Test St",
                City = "Austin",
                State = "TX",
                ZipCode = "78701",
            },
            CategoryId = catId,
            Category = new ExpenseCategory
            {
                Id = catId,
                Name = catName,
                ScheduleELine = "Line 14",
                SortOrder = 1,
            },
            Amount = amount,
            Date = date,
            Description = "Test Expense",
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    private void SetupDbSet(List<Expense> expenses)
    {
        // Simulate global query filters: soft delete + account isolation
        var filtered = expenses
            .Where(e => e.DeletedAt == null)
            .ToList();

        var mockDbSet = filtered.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(mockDbSet.Object);
    }

    #endregion
}
