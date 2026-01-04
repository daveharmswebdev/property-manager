using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Reports;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;
using IncomeEntity = PropertyManager.Domain.Entities.Income;

namespace PropertyManager.Application.Tests.Reports;

/// <summary>
/// Unit tests for GenerateScheduleEReportHandler (AC-6.1.4).
/// </summary>
public class GenerateScheduleEReportHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GenerateScheduleEReportHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GenerateScheduleEReportHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _handler = new GenerateScheduleEReportHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidProperty_ReturnsReportWithCorrectTotals()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Main House", "123 Main St", "Austin", "TX", "78701");
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(year, 1, 15), "Repairs", "Line 14"),
            CreateExpense(200m, new DateOnly(year, 3, 20), "Insurance", "Line 9"),
            CreateExpense(50m, new DateOnly(year, 6, 10), "Repairs", "Line 14") // Same category
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(1500m, new DateOnly(year, 1, 1)),
            CreateIncome(1500m, new DateOnly(year, 2, 1))
        };

        SetupDbContext(property, expenses, income);
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PropertyId.Should().Be(_testPropertyId);
        result.PropertyName.Should().Be("Main House");
        result.TaxYear.Should().Be(year);
        result.TotalIncome.Should().Be(3000m);
        result.TotalExpenses.Should().Be(350m);
        result.NetIncome.Should().Be(2650m);
    }

    [Fact]
    public async Task Handle_ValidProperty_ReturnsExpensesGroupedByCategory()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Main House", "123 Main St", "Austin", "TX", "78701");

        // Create shared category instances to ensure grouping works
        var repairsCategory = new ExpenseCategory
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111110"),
            Name = "Repairs",
            ScheduleELine = "Line 14",
            SortOrder = 10
        };
        var insuranceCategory = new ExpenseCategory
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111105"),
            Name = "Insurance",
            ScheduleELine = "Line 9",
            SortOrder = 5
        };

        var expenses = new List<Expense>
        {
            CreateExpenseWithCategory(100m, new DateOnly(year, 1, 15), repairsCategory),
            CreateExpenseWithCategory(200m, new DateOnly(year, 3, 20), insuranceCategory),
            CreateExpenseWithCategory(50m, new DateOnly(year, 6, 10), repairsCategory) // Same category
        };

        SetupDbContext(property, expenses, new List<IncomeEntity>());
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.ExpensesByCategory.Should().HaveCount(2);
        result.ExpensesByCategory.Should().Contain(e => e.CategoryName == "Repairs" && e.Amount == 150m);
        result.ExpensesByCategory.Should().Contain(e => e.CategoryName == "Insurance" && e.Amount == 200m);
    }

    private Expense CreateExpenseWithCategory(decimal amount, DateOnly date, ExpenseCategory category)
    {
        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            CategoryId = category.Id,
            Category = category,
            Amount = amount,
            Date = date,
            Description = "Test expense",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    [Fact]
    public async Task Handle_ValidProperty_ReturnsCorrectLineNumbers()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Main House", "123 Main St", "Austin", "TX", "78701");
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(year, 1, 15), "Repairs", "Line 14"),
            CreateExpense(200m, new DateOnly(year, 3, 20), "Insurance", "Line 9")
        };

        SetupDbContext(property, expenses, new List<IncomeEntity>());
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.ExpensesByCategory.Should().Contain(e => e.LineNumber == 14 && e.CategoryName == "Repairs");
        result.ExpensesByCategory.Should().Contain(e => e.LineNumber == 9 && e.CategoryName == "Insurance");
    }

    [Fact]
    public async Task Handle_PropertyWithNoData_ReturnsZeroValues()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Empty Property", "456 Empty St", "Austin", "TX", "78702");

        SetupDbContext(property, new List<Expense>(), new List<IncomeEntity>());
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalIncome.Should().Be(0m);
        result.TotalExpenses.Should().Be(0m);
        result.NetIncome.Should().Be(0m);
        result.ExpensesByCategory.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var year = 2024;
        SetupDbContext(null, new List<Expense>(), new List<IncomeEntity>());
        var query = new GenerateScheduleEReportQuery(Guid.NewGuid(), year);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_FiltersDataByYear()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Main House", "123 Main St", "Austin", "TX", "78701");
        var expenses = new List<Expense>
        {
            CreateExpense(100m, new DateOnly(2024, 1, 15), "Repairs", "Line 14"),
            CreateExpense(200m, new DateOnly(2023, 3, 20), "Insurance", "Line 9") // Different year
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(1500m, new DateOnly(2024, 1, 1)),
            CreateIncome(1000m, new DateOnly(2023, 1, 1)) // Different year
        };

        SetupDbContext(property, expenses, income);
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TotalExpenses.Should().Be(100m); // Only 2024 expenses
        result.TotalIncome.Should().Be(1500m); // Only 2024 income
    }

    [Fact]
    public async Task Handle_ReturnsFormattedAddress()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Main House", "123 Main St", "Austin", "TX", "78701");

        SetupDbContext(property, new List<Expense>(), new List<IncomeEntity>());
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.PropertyAddress.Should().Contain("123 Main St");
        result.PropertyAddress.Should().Contain("Austin");
        result.PropertyAddress.Should().Contain("TX");
    }

    [Fact]
    public async Task Handle_NegativeNetIncome_CalculatesCorrectly()
    {
        // Arrange
        var year = 2024;
        var property = CreateProperty("Money Pit", "123 Main St", "Austin", "TX", "78701");
        var expenses = new List<Expense>
        {
            CreateExpense(5000m, new DateOnly(year, 1, 15), "Repairs", "Line 14")
        };
        var income = new List<IncomeEntity>
        {
            CreateIncome(1000m, new DateOnly(year, 1, 1))
        };

        SetupDbContext(property, expenses, income);
        var query = new GenerateScheduleEReportQuery(_testPropertyId, year);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.NetIncome.Should().Be(-4000m);
    }

    private Property CreateProperty(string name, string street, string city, string state, string zip)
    {
        return new Property
        {
            Id = _testPropertyId,
            AccountId = _testAccountId,
            Name = name,
            Street = street,
            City = city,
            State = state,
            ZipCode = zip
        };
    }

    private Expense CreateExpense(decimal amount, DateOnly date, string categoryName, string scheduleELine)
    {
        var category = new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            Name = categoryName,
            ScheduleELine = scheduleELine,
            SortOrder = 1
        };

        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            CategoryId = category.Id,
            Category = category,
            Amount = amount,
            Date = date,
            Description = "Test expense",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private IncomeEntity CreateIncome(decimal amount, DateOnly date)
    {
        return new IncomeEntity
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            Amount = amount,
            Date = date,
            Description = "Rent",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupDbContext(Property? property, List<Expense> expenses, List<IncomeEntity> income)
    {
        // Setup Properties
        var properties = property != null
            ? new List<Property> { property }.AsQueryable().BuildMockDbSet()
            : new List<Property>().AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(properties.Object);

        // Setup Expenses
        var filteredExpenses = expenses.Where(e => e.DeletedAt == null).ToList();
        var expensesMock = filteredExpenses.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(expensesMock.Object);

        // Setup Income
        var filteredIncome = income.Where(i => i.DeletedAt == null).ToList();
        var incomeMock = filteredIncome.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Income).Returns(incomeMock.Object);
    }
}
