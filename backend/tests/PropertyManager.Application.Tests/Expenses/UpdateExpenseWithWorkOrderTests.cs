using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for UpdateExpenseCommandHandler WorkOrderId scenarios (AC #7, #9).
/// </summary>
public class UpdateExpenseWithWorkOrderTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly UpdateExpenseCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();

    public UpdateExpenseWithWorkOrderTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new UpdateExpenseCommandHandler(_dbContextMock.Object, _currentUserMock.Object);

        SetupCategories();
    }

    [Fact]
    public async Task Handle_SetWorkOrderId_UpdatesExpense()
    {
        // Arrange
        var expense = CreateExpense();
        SetupExpenses(new List<Expense> { expense });
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId)
        });

        var command = new UpdateExpenseCommand(
            Id: expense.Id,
            Amount: expense.Amount,
            Date: expense.Date,
            CategoryId: expense.CategoryId,
            Description: expense.Description,
            WorkOrderId: _testWorkOrderId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        expense.WorkOrderId.Should().Be(_testWorkOrderId);
    }

    [Fact]
    public async Task Handle_ClearWorkOrderId_SetsNull()
    {
        // Arrange
        var expense = CreateExpense();
        expense.WorkOrderId = _testWorkOrderId;
        SetupExpenses(new List<Expense> { expense });

        var command = new UpdateExpenseCommand(
            Id: expense.Id,
            Amount: expense.Amount,
            Date: expense.Date,
            CategoryId: expense.CategoryId,
            Description: expense.Description,
            WorkOrderId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        expense.WorkOrderId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_CrossPropertyWorkOrder_ThrowsValidationException()
    {
        // Arrange
        var expense = CreateExpense();
        SetupExpenses(new List<Expense> { expense });

        var differentPropertyId = Guid.NewGuid();
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, differentPropertyId, _testAccountId)
        });

        var command = new UpdateExpenseCommand(
            Id: expense.Id,
            Amount: expense.Amount,
            Date: expense.Date,
            CategoryId: expense.CategoryId,
            Description: expense.Description,
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
        var expense = CreateExpense();
        SetupExpenses(new List<Expense> { expense });
        SetupWorkOrders(new List<WorkOrder>());

        var nonExistentId = Guid.NewGuid();
        var command = new UpdateExpenseCommand(
            Id: expense.Id,
            Amount: expense.Amount,
            Date: expense.Date,
            CategoryId: expense.CategoryId,
            Description: expense.Description,
            WorkOrderId: nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    private Expense CreateExpense()
    {
        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            CategoryId = _testCategoryId,
            Amount = 100.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Description = "Test expense",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-10)
        };
    }

    private void SetupExpenses(List<Expense> expenses)
    {
        var filtered = expenses
            .Where(e => e.AccountId == _testAccountId && e.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(mockDbSet.Object);
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

    private void SetupCategories()
    {
        var categories = new List<ExpenseCategory>
        {
            new() { Id = _testCategoryId, Name = "Repairs", SortOrder = 1 }
        };
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
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
