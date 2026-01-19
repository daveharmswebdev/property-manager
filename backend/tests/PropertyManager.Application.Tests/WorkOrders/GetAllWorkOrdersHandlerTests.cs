using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetAllWorkOrdersQueryHandler (AC #8).
/// </summary>
public class GetAllWorkOrdersHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetAllWorkOrdersQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetAllWorkOrdersHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetAllWorkOrdersQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_NoWorkOrders_ReturnsEmptyList()
    {
        // Arrange
        var workOrders = new List<WorkOrder>();
        SetupWorkOrdersDbSet(workOrders);
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WithWorkOrders_ReturnsAllForAccount()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrders = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, property, "Fix leak"),
            CreateWorkOrder(_testAccountId, property, "Replace door"),
            CreateWorkOrder(_otherAccountId, property, "Other tenant work order")
        };
        SetupWorkOrdersDbSet(workOrders);
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(w => w.Description == "Fix leak" || w.Description == "Replace door");
    }

    [Fact]
    public async Task Handle_WorkOrdersSortedByCreatedAtDescending()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var oldWorkOrder = CreateWorkOrder(_testAccountId, property, "Old work order");
        oldWorkOrder.CreatedAt = DateTime.UtcNow.AddDays(-7);

        var newWorkOrder = CreateWorkOrder(_testAccountId, property, "New work order");
        newWorkOrder.CreatedAt = DateTime.UtcNow;

        var middleWorkOrder = CreateWorkOrder(_testAccountId, property, "Middle work order");
        middleWorkOrder.CreatedAt = DateTime.UtcNow.AddDays(-3);

        var workOrders = new List<WorkOrder> { oldWorkOrder, newWorkOrder, middleWorkOrder };
        SetupWorkOrdersDbSet(workOrders);
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].Description.Should().Be("New work order");
        result.Items[1].Description.Should().Be("Middle work order");
        result.Items[2].Description.Should().Be("Old work order");
    }

    [Fact]
    public async Task Handle_ExcludesDeletedWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var activeWorkOrder = CreateWorkOrder(_testAccountId, property, "Active work order");
        var deletedWorkOrder = CreateWorkOrder(_testAccountId, property, "Deleted work order");
        deletedWorkOrder.DeletedAt = DateTime.UtcNow;

        var workOrders = new List<WorkOrder> { activeWorkOrder, deletedWorkOrder };
        SetupWorkOrdersDbSet(workOrders);
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Description.Should().Be("Active work order");
    }

    [Fact]
    public async Task Handle_MultiTenantIsolation_OnlyReturnsCurrentAccountWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "My Property");
        var workOrders = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, property, "My Work Order 1"),
            CreateWorkOrder(_testAccountId, property, "My Work Order 2"),
            CreateWorkOrder(_otherAccountId, property, "Other Tenant 1"),
            CreateWorkOrder(_otherAccountId, property, "Other Tenant 2"),
            CreateWorkOrder(Guid.NewGuid(), property, "Third Tenant")
        };
        SetupWorkOrdersDbSet(workOrders);
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(w => w.Description.StartsWith("My Work Order"));
    }

    [Fact]
    public async Task Handle_ReturnsCorrectWorkOrderDto()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var category = new ExpenseCategory { Id = Guid.NewGuid(), Name = "Repairs" };
        var vendor = CreateVendor(_testAccountId, "John", "Plumber");
        var userId = Guid.NewGuid();

        var workOrder = CreateWorkOrder(_testAccountId, property, "Fix the sink");
        workOrder.Category = category;
        workOrder.CategoryId = category.Id;
        workOrder.Vendor = vendor;
        workOrder.VendorId = vendor.Id;
        workOrder.CreatedByUserId = userId;
        workOrder.Status = WorkOrderStatus.Assigned;

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Id.Should().Be(workOrder.Id);
        dto.PropertyId.Should().Be(property.Id);
        dto.PropertyName.Should().Be("Test Property");
        dto.VendorId.Should().Be(vendor.Id);
        dto.VendorName.Should().Be("John Plumber");
        dto.CategoryId.Should().Be(category.Id);
        dto.CategoryName.Should().Be("Repairs");
        dto.Status.Should().Be("Assigned");
        dto.Description.Should().Be("Fix the sink");
        dto.CreatedByUserId.Should().Be(userId);
    }

    [Fact]
    public async Task Handle_WorkOrderWithNullVendor_ReturnsDiyInfo()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "DIY repair");
        workOrder.VendorId = null;
        workOrder.Vendor = null;

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.VendorId.Should().BeNull();
        dto.VendorName.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WorkOrderWithTags_ReturnsTagsList()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var urgentTag = new WorkOrderTag { Id = Guid.NewGuid(), Name = "Urgent", AccountId = _testAccountId };
        var leakTag = new WorkOrderTag { Id = Guid.NewGuid(), Name = "Leak", AccountId = _testAccountId };

        var workOrder = CreateWorkOrder(_testAccountId, property, "Fix leak urgently");
        workOrder.TagAssignments = new List<WorkOrderTagAssignment>
        {
            new WorkOrderTagAssignment { WorkOrderId = workOrder.Id, TagId = urgentTag.Id, Tag = urgentTag },
            new WorkOrderTagAssignment { WorkOrderId = workOrder.Id, TagId = leakTag.Id, Tag = leakTag }
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Tags.Should().HaveCount(2);
        dto.Tags.Should().Contain(t => t.Name == "Urgent");
        dto.Tags.Should().Contain(t => t.Name == "Leak");
    }

    [Fact]
    public async Task Handle_WorkOrderWithNoTags_ReturnsEmptyTagsList()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder = CreateWorkOrder(_testAccountId, property, "Simple repair");

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        var query = new GetAllWorkOrdersQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Tags.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_StatusFilter_ReturnsOnlyMatchingStatus()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var reportedWorkOrder = CreateWorkOrder(_testAccountId, property, "Reported");
        reportedWorkOrder.Status = WorkOrderStatus.Reported;

        var assignedWorkOrder = CreateWorkOrder(_testAccountId, property, "Assigned");
        assignedWorkOrder.Status = WorkOrderStatus.Assigned;

        var completedWorkOrder = CreateWorkOrder(_testAccountId, property, "Completed");
        completedWorkOrder.Status = WorkOrderStatus.Completed;

        SetupWorkOrdersDbSet(new List<WorkOrder> { reportedWorkOrder, assignedWorkOrder, completedWorkOrder });
        var query = new GetAllWorkOrdersQuery(Status: "Assigned");

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Status.Should().Be("Assigned");
    }

    [Fact]
    public async Task Handle_PropertyFilter_ReturnsOnlyMatchingProperty()
    {
        // Arrange
        var property1 = CreateProperty(_testAccountId, "Property 1");
        var property2 = CreateProperty(_testAccountId, "Property 2");

        var workOrder1 = CreateWorkOrder(_testAccountId, property1, "Work on property 1");
        var workOrder2 = CreateWorkOrder(_testAccountId, property2, "Work on property 2");

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder1, workOrder2 });
        var query = new GetAllWorkOrdersQuery(PropertyId: property1.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].PropertyId.Should().Be(property1.Id);
        result.Items[0].Description.Should().Be("Work on property 1");
    }

    [Theory]
    [InlineData("assigned")]
    [InlineData("ASSIGNED")]
    [InlineData("Assigned")]
    [InlineData("aSsIgNeD")]
    public async Task Handle_StatusFilter_IsCaseInsensitive(string statusInput)
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var reportedWorkOrder = CreateWorkOrder(_testAccountId, property, "Reported");
        reportedWorkOrder.Status = WorkOrderStatus.Reported;

        var assignedWorkOrder = CreateWorkOrder(_testAccountId, property, "Assigned");
        assignedWorkOrder.Status = WorkOrderStatus.Assigned;

        SetupWorkOrdersDbSet(new List<WorkOrder> { reportedWorkOrder, assignedWorkOrder });
        var query = new GetAllWorkOrdersQuery(Status: statusInput);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Status.Should().Be("Assigned");
    }

    [Fact]
    public async Task Handle_InvalidStatus_ReturnsAllWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var workOrder1 = CreateWorkOrder(_testAccountId, property, "Work order 1");
        var workOrder2 = CreateWorkOrder(_testAccountId, property, "Work order 2");

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder1, workOrder2 });
        var query = new GetAllWorkOrdersQuery(Status: "InvalidStatus");

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert - Invalid status is ignored, returns all work orders
        result.Items.Should().HaveCount(2);
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
