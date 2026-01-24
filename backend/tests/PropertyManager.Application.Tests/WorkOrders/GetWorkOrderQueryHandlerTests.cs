using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetWorkOrderQueryHandler (Story 9-8).
/// </summary>
public class GetWorkOrderQueryHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetWorkOrderQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetWorkOrderQueryHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetWorkOrderQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_WorkOrderExists_ReturnsCompleteWorkOrderDto()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var category = new ExpenseCategory { Id = Guid.NewGuid(), Name = "Repairs" };
        var vendor = CreateVendor(_testAccountId, "John", "Plumber");
        var userId = Guid.NewGuid();

        var urgentTag = new WorkOrderTag { Id = Guid.NewGuid(), Name = "Urgent", AccountId = _testAccountId };
        var leakTag = new WorkOrderTag { Id = Guid.NewGuid(), Name = "Leak", AccountId = _testAccountId };

        var workOrder = CreateWorkOrder(_testAccountId, property, "Fix the leaky faucet in kitchen");
        workOrder.Category = category;
        workOrder.CategoryId = category.Id;
        workOrder.Vendor = vendor;
        workOrder.VendorId = vendor.Id;
        workOrder.CreatedByUserId = userId;
        workOrder.Status = WorkOrderStatus.Assigned;
        workOrder.TagAssignments = new List<WorkOrderTagAssignment>
        {
            new() { WorkOrderId = workOrder.Id, TagId = urgentTag.Id, Tag = urgentTag },
            new() { WorkOrderId = workOrder.Id, TagId = leakTag.Id, Tag = leakTag }
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(workOrder.Id);
        result.PropertyId.Should().Be(property.Id);
        result.PropertyName.Should().Be("Test Property");
        result.VendorId.Should().Be(vendor.Id);
        result.VendorName.Should().Be("John Plumber");
        result.IsDiy.Should().BeFalse();
        result.CategoryId.Should().Be(category.Id);
        result.CategoryName.Should().Be("Repairs");
        result.Status.Should().Be("Assigned");
        result.Description.Should().Be("Fix the leaky faucet in kitchen");
        result.CreatedByUserId.Should().Be(userId);
        result.Tags.Should().HaveCount(2);
        result.Tags.Should().Contain(t => t.Name == "Urgent");
        result.Tags.Should().Contain(t => t.Name == "Leak");
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var nonExistentId = Guid.NewGuid();
        SetupWorkOrdersDbSet(new List<WorkOrder>());
        var query = new GetWorkOrderQuery(nonExistentId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*WorkOrder*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_WorkOrderBelongsToOtherAccount_ThrowsNotFoundException()
    {
        // Arrange
        var property = CreateProperty(_otherAccountId, "Other Property");
        var workOrder = CreateWorkOrder(_otherAccountId, property, "Other tenant's work order");
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WorkOrderIsDeleted_ThrowsNotFoundException()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "Deleted work order");
        workOrder.DeletedAt = DateTime.UtcNow;
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WorkOrderWithNullVendor_ReturnsIsDiyTrue()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "DIY repair");
        workOrder.VendorId = null;
        workOrder.Vendor = null;
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.VendorId.Should().BeNull();
        result.VendorName.Should().BeNull();
        result.IsDiy.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_WorkOrderWithNoCategory_ReturnsCategoryNull()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "Uncategorized work");
        workOrder.CategoryId = null;
        workOrder.Category = null;
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.CategoryId.Should().BeNull();
        result.CategoryName.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WorkOrderWithNoTags_ReturnsEmptyTagsList()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "No tags work order");
        workOrder.TagAssignments = new List<WorkOrderTagAssignment>();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Tags.Should().BeEmpty();
    }

    [Theory]
    [InlineData(WorkOrderStatus.Reported, "Reported")]
    [InlineData(WorkOrderStatus.Assigned, "Assigned")]
    [InlineData(WorkOrderStatus.Completed, "Completed")]
    public async Task Handle_WorkOrderWithDifferentStatuses_ReturnsCorrectStatusString(
        WorkOrderStatus status, string expectedStatusString)
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "Status test");
        workOrder.Status = status;
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetWorkOrderQuery(workOrder.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Status.Should().Be(expectedStatusString);
    }

    private Property CreateProperty(Guid accountId, string name)
    {
        return new Property
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = name,
            Street = "123 Main St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private Vendor CreateVendor(Guid accountId, string firstName, string lastName)
    {
        return new Vendor
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FirstName = firstName,
            LastName = lastName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private WorkOrder CreateWorkOrder(Guid accountId, Property property, string description)
    {
        return new WorkOrder
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = property.Id,
            Property = property,
            Description = description,
            Status = WorkOrderStatus.Reported,
            CreatedByUserId = Guid.NewGuid(),
            TagAssignments = new List<WorkOrderTagAssignment>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupWorkOrdersDbSet(List<WorkOrder> workOrders)
    {
        var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }
}
