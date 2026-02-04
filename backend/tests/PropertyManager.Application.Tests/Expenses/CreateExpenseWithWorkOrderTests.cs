using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for CreateExpenseCommandHandler WorkOrderId scenarios (AC #7, #9).
/// </summary>
public class CreateExpenseWithWorkOrderTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateExpenseCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();

    public CreateExpenseWithWorkOrderTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new CreateExpenseCommandHandler(_dbContextMock.Object, _currentUserMock.Object);

        SetupBaseData();
    }

    [Fact]
    public async Task Handle_ValidExpenseWithWorkOrder_SavesAndReturns()
    {
        // Arrange
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId)
        });

        Expense? capturedExpense = null;
        _dbContextMock.Setup(x => x.Expenses.Add(It.IsAny<Expense>()))
            .Callback<Expense>(e => capturedExpense = e);

        var command = new CreateExpenseCommand(
            PropertyId: _testPropertyId,
            Amount: 100.00m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "Test expense",
            WorkOrderId: _testWorkOrderId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        capturedExpense.Should().NotBeNull();
        capturedExpense!.WorkOrderId.Should().Be(_testWorkOrderId);
    }

    [Fact]
    public async Task Handle_WorkOrderDifferentProperty_ThrowsValidationException()
    {
        // Arrange
        var differentPropertyId = Guid.NewGuid();
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, differentPropertyId, _testAccountId)
        });

        var command = new CreateExpenseCommand(
            PropertyId: _testPropertyId,
            Amount: 100.00m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "Test expense",
            WorkOrderId: _testWorkOrderId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("Expense and work order must belong to the same property");
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var nonExistentWorkOrderId = Guid.NewGuid();
        SetupWorkOrders(new List<WorkOrder>());

        var command = new CreateExpenseCommand(
            PropertyId: _testPropertyId,
            Amount: 100.00m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "Test expense",
            WorkOrderId: nonExistentWorkOrderId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentWorkOrderId}*");
    }

    [Fact]
    public async Task Handle_NullWorkOrderId_SavesWithNullWorkOrderId()
    {
        // Arrange - backward compat, no WorkOrderId
        Expense? capturedExpense = null;
        _dbContextMock.Setup(x => x.Expenses.Add(It.IsAny<Expense>()))
            .Callback<Expense>(e => capturedExpense = e);

        var command = new CreateExpenseCommand(
            PropertyId: _testPropertyId,
            Amount: 100.00m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "Test expense",
            WorkOrderId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        capturedExpense.Should().NotBeNull();
        capturedExpense!.WorkOrderId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_DeletedWorkOrder_ThrowsNotFoundException()
    {
        // Arrange
        var deletedWorkOrder = CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId);
        deletedWorkOrder.DeletedAt = DateTime.UtcNow;
        SetupWorkOrders(new List<WorkOrder> { deletedWorkOrder });

        var command = new CreateExpenseCommand(
            PropertyId: _testPropertyId,
            Amount: 100.00m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "Test expense",
            WorkOrderId: _testWorkOrderId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    private void SetupBaseData()
    {
        // Properties
        var properties = new List<Property>
        {
            new() { Id = _testPropertyId, AccountId = _testAccountId, Name = "Test Property" }
        };
        var propertiesMock = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(propertiesMock.Object);

        // Categories
        var categories = new List<ExpenseCategory>
        {
            new() { Id = _testCategoryId, Name = "Repairs", SortOrder = 1 }
        };
        var categoriesMock = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(categoriesMock.Object);

        // Expenses DbSet for Add
        var expensesMock = new List<Expense>().AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(expensesMock.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
    }

    private void SetupWorkOrders(List<WorkOrder> workOrders)
    {
        var filtered = workOrders
            .Where(w => w.AccountId == _testAccountId && w.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private WorkOrder CreateWorkOrder(Guid id, Guid propertyId, Guid accountId)
    {
        return new WorkOrder
        {
            Id = id,
            PropertyId = propertyId,
            AccountId = accountId,
            Description = "Test work order",
            CreatedByUserId = _testUserId
        };
    }
}
