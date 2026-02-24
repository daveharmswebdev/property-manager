using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for GetAllExpensesHandler — Sort functionality (AC-3 Story 15.3).
///
/// RED PHASE: These tests will NOT COMPILE until SortBy/SortDirection are added
/// to GetAllExpensesQuery. This is intentional — compilation failure IS the red state.
///
/// To reach GREEN:
/// 1. Add SortBy/SortDirection params to GetAllExpensesQuery record
/// 2. Implement dynamic sort logic in GetAllExpensesHandler.Handle()
/// 3. Pass sort params from ExpensesController.GetAllExpenses()
/// </summary>
public class GetAllExpensesHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly GetAllExpensesHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _propertyId = Guid.NewGuid();
    private readonly Guid _categoryRepairsId = Guid.NewGuid();
    private readonly Guid _categoryUtilitiesId = Guid.NewGuid();

    public GetAllExpensesHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _handler = new GetAllExpensesHandler(_dbContextMock.Object);
    }

    #region Sort Tests (AC-3 Story 15.3, Task 4.4)

    [Fact]
    public async Task Handle_SortByAmountAscending_ReturnsItemsSortedByAmount()
    {
        // Arrange — amounts intentionally NOT in date order
        var expenses = new List<Expense>
        {
            CreateExpense(300m, new DateOnly(2026, 1, 1), _categoryRepairsId, "Repairs", "Big fix"),
            CreateExpense(100m, new DateOnly(2026, 1, 2), _categoryRepairsId, "Repairs", "Small fix"),
            CreateExpense(200m, new DateOnly(2026, 1, 3), _categoryUtilitiesId, "Utilities", "Electric"),
        };
        SetupDbSet(expenses);

        // NOTE: SortBy/SortDirection don't exist on GetAllExpensesQuery yet — RED PHASE
        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, PropertyId: null, Search: null, Year: null,
            SortBy: "amount", SortDirection: "asc",
            Page: 1, PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].Amount.Should().Be(100m);
        result.Items[1].Amount.Should().Be(200m);
        result.Items[2].Amount.Should().Be(300m);
    }

    [Fact]
    public async Task Handle_SortByDateAscending_ReturnsOldestFirst()
    {
        // Arrange — default is date DESCENDING, this tests explicit ascending
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 3, 1), _categoryRepairsId, "Repairs", "March"),
            CreateExpense(100m, new DateOnly(2026, 1, 1), _categoryRepairsId, "Repairs", "January"),
            CreateExpense(100m, new DateOnly(2026, 2, 1), _categoryRepairsId, "Repairs", "February"),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, PropertyId: null, Search: null, Year: null,
            SortBy: "date", SortDirection: "asc",
            Page: 1, PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert — oldest first (opposite of default)
        result.Items[0].Date.Should().Be(new DateOnly(2026, 1, 1));
        result.Items[1].Date.Should().Be(new DateOnly(2026, 2, 1));
        result.Items[2].Date.Should().Be(new DateOnly(2026, 3, 1));
    }

    [Fact]
    public async Task Handle_SortByPropertyName_ReturnsItemsSortedByPropertyName()
    {
        // Arrange — navigation property sort (tests EF Include/Select)
        var secondPropertyId = Guid.NewGuid();
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 1), _categoryRepairsId, "Repairs", "Fix", _propertyId, "Zebra Ranch"),
            CreateExpense(100m, new DateOnly(2026, 1, 2), _categoryRepairsId, "Repairs", "Fix", secondPropertyId, "Alpha House"),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, PropertyId: null, Search: null, Year: null,
            SortBy: "property", SortDirection: "asc",
            Page: 1, PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert — "Alpha House" before "Zebra Ranch"
        result.Items[0].PropertyName.Should().Be("Alpha House");
        result.Items[1].PropertyName.Should().Be("Zebra Ranch");
    }

    [Fact]
    public async Task Handle_NullSortBy_DefaultsToDateDescending()
    {
        // Arrange
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 1), _categoryRepairsId, "Repairs", "Old"),
            CreateExpense(200m, new DateOnly(2026, 6, 15), _categoryRepairsId, "Repairs", "New"),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, PropertyId: null, Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert — newest first (default behavior preserved)
        result.Items[0].Date.Should().Be(new DateOnly(2026, 6, 15));
        result.Items[1].Date.Should().Be(new DateOnly(2026, 1, 1));
    }

    #endregion

    #region PropertyId Filter Tests (AC-16.11.3, Task 3.1)

    [Fact]
    public async Task Handle_WithPropertyId_FiltersExpensesByProperty()
    {
        // Arrange
        var secondPropertyId = Guid.NewGuid();
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 1), _categoryRepairsId, "Repairs", "Plumbing fix", _propertyId, "Test Property"),
            CreateExpense(200m, new DateOnly(2026, 1, 2), _categoryUtilitiesId, "Utilities", "Electric", secondPropertyId, "Beach House"),
            CreateExpense(300m, new DateOnly(2026, 1, 3), _categoryRepairsId, "Repairs", "Roof repair", _propertyId, "Test Property"),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, PropertyId: _propertyId,
            Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(e => e.PropertyId == _propertyId);
        result.TotalAmount.Should().Be(400m);
    }

    [Fact]
    public async Task Handle_WithNullPropertyId_ReturnsAllExpenses()
    {
        // Arrange
        var secondPropertyId = Guid.NewGuid();
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2026, 1, 1), _categoryRepairsId, "Repairs", "Fix", _propertyId, "Test Property"),
            CreateExpense(200m, new DateOnly(2026, 1, 2), _categoryUtilitiesId, "Utilities", "Bill", secondPropertyId, "Beach House"),
        };
        SetupDbSet(expenses);

        var query = new GetAllExpensesQuery(
            DateFrom: null, DateTo: null, CategoryIds: null, PropertyId: null,
            Search: null, Year: null,
            SortBy: null, SortDirection: null,
            Page: 1, PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
    }

    #endregion

    #region Helper Methods

    private Expense CreateExpense(
        decimal amount,
        DateOnly date,
        Guid categoryId,
        string categoryName,
        string description,
        Guid? propertyId = null,
        string? propertyName = null)
    {
        var pid = propertyId ?? _propertyId;
        var pname = propertyName ?? "Test Property";

        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = pid,
            Property = new Property
            {
                Id = pid,
                AccountId = _testAccountId,
                Name = pname,
                Street = "123 Test St",
                City = "Austin",
                State = "TX",
                ZipCode = "78701",
            },
            CategoryId = categoryId,
            Category = new ExpenseCategory
            {
                Id = categoryId,
                Name = categoryName,
                ScheduleELine = "Line 14",
                SortOrder = 1,
            },
            Amount = amount,
            Date = date,
            Description = description,
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
