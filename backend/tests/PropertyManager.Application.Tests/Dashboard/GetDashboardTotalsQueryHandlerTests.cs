using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Dashboard;
using PropertyManager.Domain.Entities;
using IncomeEntity = PropertyManager.Domain.Entities.Income;

namespace PropertyManager.Application.Tests.Dashboard;

/// <summary>
/// Unit tests for <see cref="GetDashboardTotalsQueryHandler"/> (Story 21.10 — AC-1).
///
/// Reality check (epic vs. shipped handler): the handler does NOT compute
/// percentage-change or period-comparison math. It only sums expenses + income
/// for a year/date range, counts active properties, and computes
/// <c>NetIncome = TotalIncome - TotalExpenses</c>. Account isolation and
/// soft-delete exclusion are performed manually in each query — tests must
/// seed cross-account and soft-deleted rows to exercise those filters.
///
/// Pattern reference: <see cref="Properties.GetAllPropertiesHandlerTests"/>.
/// </summary>
public class GetDashboardTotalsQueryHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetDashboardTotalsQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetDashboardTotalsQueryHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new GetDashboardTotalsQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.1: empty DbSets → zeros
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_NoData_ReturnsAllZeros()
    {
        // Arrange
        SetupExpensesDbSet(new List<Expense>());
        SetupIncomeDbSet(new List<IncomeEntity>());
        SetupPropertiesDbSet(new List<Property>());
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.TotalExpenses.Should().Be(0m);
        result.TotalIncome.Should().Be(0m);
        result.NetIncome.Should().Be(0m);
        result.PropertyCount.Should().Be(0);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.2: one property, one expense, one income → basic totals
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_OneProperty_OneExpense_OneIncome_ReturnsBasicTotals()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Property A");
        var expense = CreateExpense(_testAccountId, property.Id, 200m, new DateOnly(2026, 3, 15));
        var income = CreateIncome(_testAccountId, property.Id, 1000m, new DateOnly(2026, 3, 1));

        SetupPropertiesDbSet(new List<Property> { property });
        SetupExpensesDbSet(new List<Expense> { expense });
        SetupIncomeDbSet(new List<IncomeEntity> { income });
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(200m);
        result.TotalIncome.Should().Be(1000m);
        result.NetIncome.Should().Be(800m);
        result.PropertyCount.Should().Be(1);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.3: multiple properties + multiple expenses/income → sums correctly
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_MultiplePropertiesAndRows_SumsAllForAccount()
    {
        // Arrange
        var p1 = CreateProperty(_testAccountId, "Property 1");
        var p2 = CreateProperty(_testAccountId, "Property 2");
        var properties = new List<Property> { p1, p2 };

        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, p1.Id, 100m, new DateOnly(2026, 1, 15)),
            CreateExpense(_testAccountId, p1.Id, 200m, new DateOnly(2026, 4, 10)),
            CreateExpense(_testAccountId, p2.Id, 300m, new DateOnly(2026, 7, 20)),
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(_testAccountId, p1.Id, 500m, new DateOnly(2026, 2, 1)),
            CreateIncome(_testAccountId, p2.Id, 1500m, new DateOnly(2026, 6, 1)),
        };

        SetupPropertiesDbSet(properties);
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(income);
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(600m);
        result.TotalIncome.Should().Be(2000m);
        result.NetIncome.Should().Be(1400m);
        result.PropertyCount.Should().Be(2);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.4: expenses exceed income → negative NetIncome
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_ExpensesExceedIncome_ReturnsNegativeNetIncome()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Money Pit");
        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, property.Id, 5000m, new DateOnly(2026, 5, 1)),
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(_testAccountId, property.Id, 2000m, new DateOnly(2026, 5, 15)),
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(income);
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(5000m);
        result.TotalIncome.Should().Be(2000m);
        result.NetIncome.Should().Be(-3000m);
        result.PropertyCount.Should().Be(1);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.5: year filter excludes prior-year data
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_YearFilter_ExcludesPriorYearData()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Cross-Year Property");

        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, property.Id, 100m, new DateOnly(2024, 6, 15)), // excluded
            CreateExpense(_testAccountId, property.Id, 200m, new DateOnly(2026, 6, 15)), // included
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(_testAccountId, property.Id, 500m, new DateOnly(2024, 6, 15)),  // excluded
            CreateIncome(_testAccountId, property.Id, 300m, new DateOnly(2026, 6, 15)),  // included
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(income);
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(200m);
        result.TotalIncome.Should().Be(300m);
        result.NetIncome.Should().Be(100m);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.6: account isolation — other account's rows are excluded
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_OtherAccountData_IsExcluded()
    {
        // Arrange
        var myProperty = CreateProperty(_testAccountId, "My Property");
        var theirProperty = CreateProperty(_otherAccountId, "Their Property");

        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, myProperty.Id, 100m, new DateOnly(2026, 6, 15)),
            CreateExpense(_otherAccountId, theirProperty.Id, 999m, new DateOnly(2026, 6, 15)),
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(_testAccountId, myProperty.Id, 500m, new DateOnly(2026, 6, 15)),
            CreateIncome(_otherAccountId, theirProperty.Id, 9999m, new DateOnly(2026, 6, 15)),
        };

        SetupPropertiesDbSet(new List<Property> { myProperty, theirProperty });
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(income);
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(100m);
        result.TotalIncome.Should().Be(500m);
        result.NetIncome.Should().Be(400m);
        result.PropertyCount.Should().Be(1);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.7: soft-deleted rows are excluded from all three DbSets, but a
    // soft-deleted property's still-active income row IS counted (handler
    // does not join Properties when summing income/expenses).
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_SoftDeletedRows_AreExcludedAcrossAllThreeDbSets()
    {
        // Arrange
        var activeProperty = CreateProperty(_testAccountId, "Active Property");
        var deletedProperty = CreateProperty(_testAccountId, "Deleted Property", DateTime.UtcNow);

        var properties = new List<Property> { activeProperty, deletedProperty };

        var activeExpense = CreateExpense(_testAccountId, activeProperty.Id, 100m, new DateOnly(2026, 6, 15));
        var deletedExpense = CreateExpense(_testAccountId, activeProperty.Id, 100m, new DateOnly(2026, 6, 15), DateTime.UtcNow);

        // An expense whose property is soft-deleted but the expense itself is active —
        // handler does NOT join Properties, so this MUST be counted.
        var orphanedExpense = CreateExpense(_testAccountId, deletedProperty.Id, 50m, new DateOnly(2026, 6, 15));

        var activeIncome = CreateIncome(_testAccountId, activeProperty.Id, 500m, new DateOnly(2026, 6, 15));
        var deletedIncome = CreateIncome(_testAccountId, activeProperty.Id, 500m, new DateOnly(2026, 6, 15), DateTime.UtcNow);

        SetupPropertiesDbSet(properties);
        SetupExpensesDbSet(new List<Expense> { activeExpense, deletedExpense, orphanedExpense });
        SetupIncomeDbSet(new List<IncomeEntity> { activeIncome, deletedIncome });
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        // Expenses: 100 (active) + 50 (orphaned but not soft-deleted) — deletedExpense excluded.
        result.TotalExpenses.Should().Be(150m);
        // Income: 500 (active) — deletedIncome excluded.
        result.TotalIncome.Should().Be(500m);
        result.NetIncome.Should().Be(350m);
        // PropertyCount excludes the soft-deleted property.
        result.PropertyCount.Should().Be(1);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.8: when request.Year is null, handler defaults to UtcNow.Year
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_NullYear_DefaultsToCurrentYear()
    {
        // Arrange
        var currentYear = DateTime.UtcNow.Year;
        var property = CreateProperty(_testAccountId, "Current-Year Property");

        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, property.Id, 50m, new DateOnly(currentYear, 6, 15)),  // included
            CreateExpense(_testAccountId, property.Id, 999m, new DateOnly(2020, 6, 15)),         // excluded
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(new List<IncomeEntity>());
        var query = new GetDashboardTotalsQuery(null, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(50m);
        result.PropertyCount.Should().Be(1);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.9: explicit DateFrom + DateTo override the year-derived range
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_ExplicitDateFromAndDateTo_OverrideYearRange()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Explicit-Range Property");

        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, property.Id, 100m, new DateOnly(2026, 1, 1)),   // outside [Mar 1, May 31]
            CreateExpense(_testAccountId, property.Id, 200m, new DateOnly(2026, 3, 15)),  // inside
            CreateExpense(_testAccountId, property.Id, 300m, new DateOnly(2026, 6, 30)),  // outside
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(new List<IncomeEntity>());
        var query = new GetDashboardTotalsQuery(
            2026,
            new DateOnly(2026, 3, 1),
            new DateOnly(2026, 5, 31));

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(200m);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // AC-1.10: date boundary inclusivity — Jan 1 and Dec 31 are both included
    // ───────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Handle_DateBoundaries_AreInclusive()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Boundary Property");

        var expenses = new List<Expense>
        {
            CreateExpense(_testAccountId, property.Id, 100m, new DateOnly(2026, 1, 1)),    // boundary — included
            CreateExpense(_testAccountId, property.Id, 200m, new DateOnly(2026, 12, 31)),  // boundary — included
            CreateExpense(_testAccountId, property.Id, 300m, new DateOnly(2025, 12, 31)),  // outside
            CreateExpense(_testAccountId, property.Id, 400m, new DateOnly(2027, 1, 1)),    // outside
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupExpensesDbSet(expenses);
        SetupIncomeDbSet(new List<IncomeEntity>());
        var query = new GetDashboardTotalsQuery(2026, null, null);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(300m);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────────────────
    private void SetupExpensesDbSet(List<Expense> expenses)
    {
        var mockDbSet = expenses.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(mockDbSet.Object);
    }

    private void SetupIncomeDbSet(List<IncomeEntity> income)
    {
        var mockDbSet = income.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Income).Returns(mockDbSet.Object);
    }

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private static Property CreateProperty(Guid accountId, string name, DateTime? deletedAt = null)
    {
        return new Property
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = name,
            Street = "123 Test Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = deletedAt,
        };
    }

    private static Expense CreateExpense(
        Guid accountId,
        Guid propertyId,
        decimal amount,
        DateOnly date,
        DateTime? deletedAt = null)
    {
        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            CategoryId = Guid.NewGuid(),
            Amount = amount,
            Date = date,
            Description = "Test expense",
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = deletedAt,
        };
    }

    private static IncomeEntity CreateIncome(
        Guid accountId,
        Guid propertyId,
        decimal amount,
        DateOnly date,
        DateTime? deletedAt = null)
    {
        return new IncomeEntity
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            Amount = amount,
            Date = date,
            Source = "Rent",
            Description = "Test income",
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = deletedAt,
        };
    }
}
