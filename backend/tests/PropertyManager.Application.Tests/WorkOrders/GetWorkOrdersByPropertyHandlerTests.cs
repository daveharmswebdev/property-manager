using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetWorkOrdersByPropertyQueryHandler (Story 9-11 AC #1, #5).
/// Tests work order retrieval for a specific property on property detail page.
/// </summary>
public class GetWorkOrdersByPropertyHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GetWorkOrdersByPropertyQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetWorkOrdersByPropertyHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetWorkOrdersByPropertyQueryHandler(_dbContextMock.Object, _currentUserMock.Object, _photoServiceMock.Object);
    }

    [Fact]
    public async Task Handle_ReturnsWorkOrdersForSpecifiedProperty()
    {
        // Arrange
        var property1 = CreateProperty(_testAccountId, "Property 1");
        var property2 = CreateProperty(_testAccountId, "Property 2");

        var workOrdersProperty1 = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, property1, "Fix leak in property 1"),
            CreateWorkOrder(_testAccountId, property1, "Replace door in property 1")
        };
        var workOrderProperty2 = CreateWorkOrder(_testAccountId, property2, "Paint walls in property 2");

        var allWorkOrders = workOrdersProperty1.Concat(new[] { workOrderProperty2 }).ToList();
        SetupWorkOrdersDbSet(allWorkOrders);

        var query = new GetWorkOrdersByPropertyQuery(property1.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(w => w.PropertyId == property1.Id);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyForPropertyWithNoWorkOrders()
    {
        // Arrange
        var propertyWithWorkOrders = CreateProperty(_testAccountId, "Has Work Orders");
        var propertyWithoutWorkOrders = CreateProperty(_testAccountId, "No Work Orders");

        var workOrders = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, propertyWithWorkOrders, "Some work")
        };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByPropertyQuery(propertyWithoutWorkOrders.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_RespectsTenantIsolation()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "My Property");

        var myWorkOrder = CreateWorkOrder(_testAccountId, property, "My work order");
        var otherTenantWorkOrder = CreateWorkOrder(_otherAccountId, property, "Other tenant work order");
        otherTenantWorkOrder.PropertyId = property.Id; // Same property ID but different account

        var workOrders = new List<WorkOrder> { myWorkOrder, otherTenantWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByPropertyQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Description.Should().Be("My work order");
    }

    [Fact]
    public async Task Handle_RespectsLimitParameter()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");

        var workOrders = new List<WorkOrder>();
        for (int i = 1; i <= 10; i++)
        {
            var wo = CreateWorkOrder(_testAccountId, property, $"Work order {i}");
            wo.CreatedAt = DateTime.UtcNow.AddDays(-i); // Older work orders have higher numbers
            workOrders.Add(wo);
        }
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByPropertyQuery(property.Id, Limit: 5);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(5);
        result.TotalCount.Should().Be(10); // Total count should be all work orders
    }

    [Fact]
    public async Task Handle_OrdersByCreatedAtDescending()
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

        var query = new GetWorkOrdersByPropertyQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].Description.Should().Be("New work order");
        result.Items[1].Description.Should().Be("Middle work order");
        result.Items[2].Description.Should().Be("Old work order");
    }

    [Fact]
    public async Task Handle_ExcludesSoftDeletedWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");

        var activeWorkOrder = CreateWorkOrder(_testAccountId, property, "Active work order");
        var deletedWorkOrder = CreateWorkOrder(_testAccountId, property, "Deleted work order");
        deletedWorkOrder.DeletedAt = DateTime.UtcNow;

        var workOrders = new List<WorkOrder> { activeWorkOrder, deletedWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByPropertyQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Description.Should().Be("Active work order");
    }

    [Fact]
    public async Task Handle_NoLimit_ReturnsAllWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");

        var workOrders = new List<WorkOrder>();
        for (int i = 1; i <= 20; i++)
        {
            workOrders.Add(CreateWorkOrder(_testAccountId, property, $"Work order {i}"));
        }
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByPropertyQuery(property.Id); // No limit

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(20);
        result.TotalCount.Should().Be(20);
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
        var query = new GetWorkOrdersByPropertyQuery(property.Id);

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
    public async Task Handle_LimitGreaterThanTotal_ReturnsAllItems()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");

        var workOrders = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, property, "Work order 1"),
            CreateWorkOrder(_testAccountId, property, "Work order 2"),
            CreateWorkOrder(_testAccountId, property, "Work order 3")
        };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByPropertyQuery(property.Id, Limit: 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.TotalCount.Should().Be(3);
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
        var query = new GetWorkOrdersByPropertyQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Tags.Should().HaveCount(2);
        dto.Tags.Should().Contain(t => t.Name == "Urgent");
        dto.Tags.Should().Contain(t => t.Name == "Leak");
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
            Photos = new List<WorkOrderPhoto>(),
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
