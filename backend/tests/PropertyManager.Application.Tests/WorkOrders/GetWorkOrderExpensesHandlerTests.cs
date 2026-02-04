using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetWorkOrderExpensesHandler (AC #6).
/// </summary>
public class GetWorkOrderExpensesHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly GetWorkOrderExpensesHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();

    public GetWorkOrderExpensesHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _handler = new GetWorkOrderExpensesHandler(_dbContextMock.Object);
    }

    [Fact]
    public async Task Handle_WorkOrderWithExpenses_ReturnsListWithCount()
    {
        // Arrange
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId)
        });

        var category = new ExpenseCategory { Id = _testCategoryId, Name = "Repairs", SortOrder = 1 };
        var expenses = new List<Expense>
        {
            CreateExpense(Guid.NewGuid(), _testWorkOrderId, 100.00m, "Plumbing fix", category),
            CreateExpense(Guid.NewGuid(), _testWorkOrderId, 50.00m, "Parts", category)
        };
        SetupExpenses(expenses);

        var query = new GetWorkOrderExpensesQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().AllSatisfy(item =>
        {
            item.CategoryName.Should().Be("Repairs");
        });
    }

    [Fact]
    public async Task Handle_WorkOrderNoExpenses_ReturnsEmptyList()
    {
        // Arrange
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId)
        });
        SetupExpenses(new List<Expense>());

        var query = new GetWorkOrderExpensesQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupWorkOrders(new List<WorkOrder>());

        var nonExistentId = Guid.NewGuid();
        var query = new GetWorkOrderExpensesQuery(nonExistentId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_RespectsAccountIsolation()
    {
        // Arrange - work order belongs to different account (not visible due to global query filter)
        var otherAccountWorkOrder = CreateWorkOrder(_testWorkOrderId, _testPropertyId, Guid.NewGuid());
        // Simulate global query filter: other account's work orders are not visible
        SetupWorkOrders(new List<WorkOrder>());

        var query = new GetWorkOrderExpensesQuery(_testWorkOrderId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ExcludesSoftDeletedExpenses()
    {
        // Arrange
        SetupWorkOrders(new List<WorkOrder>
        {
            CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId)
        });

        var category = new ExpenseCategory { Id = _testCategoryId, Name = "Repairs", SortOrder = 1 };
        var activeExpense = CreateExpense(Guid.NewGuid(), _testWorkOrderId, 100.00m, "Active", category);
        var deletedExpense = CreateExpense(Guid.NewGuid(), _testWorkOrderId, 50.00m, "Deleted", category);
        deletedExpense.DeletedAt = DateTime.UtcNow;

        // Only pass active expenses (soft-deleted are filtered out)
        SetupExpenses(new List<Expense> { activeExpense });

        var query = new GetWorkOrderExpensesQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Description.Should().Be("Active");
    }

    [Fact]
    public async Task Handle_DeletedWorkOrder_ThrowsNotFoundException()
    {
        // Arrange
        var deletedWorkOrder = CreateWorkOrder(_testWorkOrderId, _testPropertyId, _testAccountId);
        deletedWorkOrder.DeletedAt = DateTime.UtcNow;
        // Simulate: deleted work orders excluded by DeletedAt filter in handler
        SetupWorkOrders(new List<WorkOrder> { deletedWorkOrder });

        var query = new GetWorkOrderExpensesQuery(_testWorkOrderId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    private void SetupWorkOrders(List<WorkOrder> workOrders)
    {
        var filtered = workOrders.Where(w => w.DeletedAt == null).ToList();
        var mockDbSet = filtered.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private void SetupExpenses(List<Expense> expenses)
    {
        var filtered = expenses.Where(e => e.DeletedAt == null).ToList();
        var mockDbSet = filtered.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(mockDbSet.Object);
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

    private Expense CreateExpense(Guid id, Guid workOrderId, decimal amount, string description, ExpenseCategory category)
    {
        return new Expense
        {
            Id = id,
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            CategoryId = _testCategoryId,
            Category = category,
            WorkOrderId = workOrderId,
            Amount = amount,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Description = description,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }
}
