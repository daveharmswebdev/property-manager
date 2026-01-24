using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for DeleteWorkOrderCommandHandler (AC #5, #6, #7).
/// Tests soft delete behavior for work orders.
/// </summary>
public class DeleteWorkOrderHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<ILogger<DeleteWorkOrderCommandHandler>> _loggerMock;
    private readonly DeleteWorkOrderCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public DeleteWorkOrderHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _loggerMock = new Mock<ILogger<DeleteWorkOrderCommandHandler>>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new DeleteWorkOrderCommandHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ValidWorkOrder_SetsDeletedAt()
    {
        // Arrange (AC #5, #6)
        var workOrder = CreateWorkOrder(_testAccountId);
        workOrder.DeletedAt.Should().BeNull(); // Verify precondition
        var workOrders = new List<WorkOrder> { workOrder };
        SetupWorkOrdersDbSet(workOrders);

        var command = new DeleteWorkOrderCommand(workOrder.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.DeletedAt.Should().NotBeNull();
        workOrder.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_ValidWorkOrder_CallsSaveChanges()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var workOrders = new List<WorkOrder> { workOrder };
        SetupWorkOrdersDbSet(workOrders);

        var command = new DeleteWorkOrderCommand(workOrder.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange (AC #7)
        var workOrders = new List<WorkOrder>();
        SetupWorkOrdersDbSet(workOrders);

        var nonExistentId = Guid.NewGuid();
        var command = new DeleteWorkOrderCommand(nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_WorkOrderBelongsToOtherAccount_ThrowsNotFoundException()
    {
        // Arrange (tenant isolation)
        var otherAccountWorkOrder = CreateWorkOrder(_otherAccountId);
        var workOrders = new List<WorkOrder> { otherAccountWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var command = new DeleteWorkOrderCommand(otherAccountWorkOrder.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_AlreadyDeletedWorkOrder_ThrowsNotFoundException()
    {
        // Arrange - already deleted work orders should not be deletable again
        var deletedWorkOrder = CreateWorkOrder(_testAccountId);
        deletedWorkOrder.DeletedAt = DateTime.UtcNow.AddDays(-1);
        var workOrders = new List<WorkOrder> { deletedWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var command = new DeleteWorkOrderCommand(deletedWorkOrder.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_DoesNotChangeOtherWorkOrderFields()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var originalDescription = workOrder.Description;
        var originalPropertyId = workOrder.PropertyId;
        var originalAccountId = workOrder.AccountId;
        var originalStatus = workOrder.Status;
        var originalCreatedAt = workOrder.CreatedAt;

        var workOrders = new List<WorkOrder> { workOrder };
        SetupWorkOrdersDbSet(workOrders);

        var command = new DeleteWorkOrderCommand(workOrder.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Only DeletedAt should change
        workOrder.Description.Should().Be(originalDescription);
        workOrder.PropertyId.Should().Be(originalPropertyId);
        workOrder.AccountId.Should().Be(originalAccountId);
        workOrder.Status.Should().Be(originalStatus);
        workOrder.CreatedAt.Should().Be(originalCreatedAt);
    }

    private WorkOrder CreateWorkOrder(Guid accountId)
    {
        return new WorkOrder
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = Guid.NewGuid(),
            Description = "Test work order",
            Status = WorkOrderStatus.Reported,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-10),
            DeletedAt = null,
            TagAssignments = new List<WorkOrderTagAssignment>()
        };
    }

    private void SetupWorkOrdersDbSet(List<WorkOrder> workOrders)
    {
        var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
