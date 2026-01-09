using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for GetExpensesByPropertyHandler (AC-3.1.7, AC-7.5.1, AC-7.5.2, AC-7.5.3).
/// </summary>
public class GetExpensesByPropertyHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly GetExpensesByPropertyQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();

    public GetExpensesByPropertyHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _handler = new GetExpensesByPropertyQueryHandler(_dbContextMock.Object);
    }

    #region Default Pagination Tests (AC-7.5.2)

    [Fact]
    public async Task Handle_DefaultPagination_ReturnsFirst25Items()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(30, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(25);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(25);
        result.TotalCount.Should().Be(30);
        result.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task Handle_DefaultPagination_ReturnsNewestFirst()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(10, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeInDescendingOrder(e => e.Date);
    }

    #endregion

    #region Page Navigation Tests (AC-7.5.3)

    [Fact]
    public async Task Handle_Page2_ReturnsCorrectItems()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(30, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 2, PageSize: 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(10);
        result.Page.Should().Be(2);
        result.TotalCount.Should().Be(30);
        result.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task Handle_LastPage_ReturnsRemainingItems()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(25, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 3, PageSize: 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(5); // Only 5 remaining items
        result.Page.Should().Be(3);
        result.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task Handle_PageBeyondTotal_ReturnsEmptyList()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(10, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 5, PageSize: 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.Page.Should().Be(5);
        result.TotalCount.Should().Be(10);
    }

    #endregion

    #region Page Size Limits Tests (AC-7.5.2)

    [Fact]
    public async Task Handle_PageSizeExceeds100_ClampedTo100()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(150, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 1, PageSize: 200);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(100);
        result.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task Handle_PageSizeLessThan1_ClampedTo1()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(10, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 1, PageSize: 0);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.PageSize.Should().Be(1);
    }

    [Fact]
    public async Task Handle_NegativePageSize_ClampedTo1()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(10, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 1, PageSize: -5);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PageSize.Should().Be(1);
    }

    [Fact]
    public async Task Handle_PageLessThan1_ClampedTo1()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(10, year);
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 0, PageSize: 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Page.Should().Be(1);
    }

    #endregion

    #region Total Count Tests (AC-7.5.3)

    [Fact]
    public async Task Handle_TotalCountRemainsAccurateAcrossPages()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(50, year);
        SetupDbSets(expenses);

        // Act - Get different pages
        var page1Result = await _handler.Handle(
            new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 1, PageSize: 20),
            CancellationToken.None);

        var page2Result = await _handler.Handle(
            new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 2, PageSize: 20),
            CancellationToken.None);

        var page3Result = await _handler.Handle(
            new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 3, PageSize: 20),
            CancellationToken.None);

        // Assert
        page1Result.TotalCount.Should().Be(50);
        page2Result.TotalCount.Should().Be(50);
        page3Result.TotalCount.Should().Be(50);

        page1Result.TotalPages.Should().Be(3);
        page2Result.TotalPages.Should().Be(3);
        page3Result.TotalPages.Should().Be(3);
    }

    #endregion

    #region YtdTotal Tests (AC-7.5.1, AC-7.5.3)

    [Fact]
    public async Task Handle_YtdTotal_IndependentOfPagination()
    {
        // Arrange
        var year = 2024;
        var expenses = CreateExpenses(30, year); // Each expense is $100
        SetupDbSets(expenses);

        // Act - Get different pages
        var page1Result = await _handler.Handle(
            new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 1, PageSize: 10),
            CancellationToken.None);

        var page2Result = await _handler.Handle(
            new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 2, PageSize: 10),
            CancellationToken.None);

        // Assert - YtdTotal should be total of ALL expenses, not just current page
        var expectedTotal = 30 * 100m; // 30 expenses at $100 each
        page1Result.YtdTotal.Should().Be(expectedTotal);
        page2Result.YtdTotal.Should().Be(expectedTotal);
    }

    [Fact]
    public async Task Handle_YtdTotal_CalculatesAllMatchingExpenses()
    {
        // Arrange
        var year = 2024;
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(year, 1, 15)),
            CreateExpense(200m, new DateOnly(year, 3, 20)),
            CreateExpense(300m, new DateOnly(year, 6, 10)),
            CreateExpense(400m, new DateOnly(year, 9, 5)),
            CreateExpense(500m, new DateOnly(year, 12, 1))
        };
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year, Page: 1, PageSize: 2);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.YtdTotal.Should().Be(1500m); // Sum of all 5 expenses
        result.Items.Should().HaveCount(2); // Only 2 items on page
    }

    #endregion

    #region Year Filter Tests

    [Fact]
    public async Task Handle_YearFilter_OnlyReturnsExpensesForYear()
    {
        // Arrange
        var year = 2024;
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2024, 1, 15)),
            CreateExpense(200m, new DateOnly(2024, 6, 10)),
            CreateExpense(300m, new DateOnly(2023, 6, 10)) // Different year
        };
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalCount.Should().Be(2);
        result.YtdTotal.Should().Be(300m);
    }

    [Fact]
    public async Task Handle_NoYearFilter_ReturnsAllExpenses()
    {
        // Arrange
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2024, 1, 15)),
            CreateExpense(200m, new DateOnly(2023, 6, 10)),
            CreateExpense(300m, new DateOnly(2022, 6, 10))
        };
        SetupDbSets(expenses);

        var query = new GetExpensesByPropertyQuery(_testPropertyId, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalCount.Should().Be(3);
        result.YtdTotal.Should().Be(600m);
    }

    #endregion

    #region Property Validation Tests

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var nonExistentPropertyId = Guid.NewGuid();
        SetupDbSets(new List<Expense>(), propertyExists: false);

        var query = new GetExpensesByPropertyQuery(nonExistentPropertyId, 2024);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(
            () => _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PropertyExistsNoExpenses_ReturnsEmptyList()
    {
        // Arrange
        SetupDbSets(new List<Expense>());

        var query = new GetExpensesByPropertyQuery(_testPropertyId, 2024);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.YtdTotal.Should().Be(0);
        result.TotalPages.Should().Be(1); // Even with 0 items, we have 1 page
    }

    #endregion

    #region Helper Methods

    private List<Expense> CreateExpenses(int count, int year)
    {
        var expenses = new List<Expense>();
        var startDate = new DateOnly(year, 1, 1);

        for (int i = 0; i < count; i++)
        {
            expenses.Add(CreateExpense(100m, startDate.AddDays(i)));
        }

        return expenses;
    }

    private Expense CreateExpense(decimal amount, DateOnly date)
    {
        var property = new Property
        {
            Id = _testPropertyId,
            AccountId = _testAccountId,
            Name = "Test Property",
            Street = "123 Test St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        var category = new ExpenseCategory
        {
            Id = _testCategoryId,
            Name = "Repairs",
            ScheduleELine = "Line 14",
            SortOrder = 1
        };

        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            Property = property,
            CategoryId = _testCategoryId,
            Category = category,
            Amount = amount,
            Date = date,
            Description = "Test expense",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupDbSets(List<Expense> expenses, bool propertyExists = true)
    {
        // Setup Properties DbSet
        var properties = propertyExists
            ? new List<Property>
            {
                new Property
                {
                    Id = _testPropertyId,
                    AccountId = _testAccountId,
                    Name = "Test Property",
                    Street = "123 Test St",
                    City = "Austin",
                    State = "TX",
                    ZipCode = "78701"
                }
            }
            : new List<Property>();

        var mockPropertiesDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockPropertiesDbSet.Object);

        // Filter expenses to simulate global query filter (soft delete)
        var filteredExpenses = expenses
            .Where(e => e.DeletedAt == null && e.PropertyId == _testPropertyId)
            .ToList();

        var mockExpensesDbSet = filteredExpenses.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(mockExpensesDbSet.Object);
    }

    #endregion
}
