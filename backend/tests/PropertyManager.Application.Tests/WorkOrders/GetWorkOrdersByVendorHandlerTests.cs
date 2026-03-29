using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetWorkOrdersByVendorQueryHandler (Story 17.7 AC #1).
/// Tests work order retrieval for a specific vendor on vendor detail page.
/// </summary>
public class GetWorkOrdersByVendorHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetWorkOrdersByVendorQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetWorkOrdersByVendorHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetWorkOrdersByVendorQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ReturnsWorkOrdersForSpecifiedVendor()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var vendor1 = CreateVendor(_testAccountId, "John", "Plumber");
        var vendor2 = CreateVendor(_testAccountId, "Jane", "Electrician");

        var workOrdersVendor1 = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, property, "Fix leak", vendor1),
            CreateWorkOrder(_testAccountId, property, "Replace faucet", vendor1)
        };
        var workOrderVendor2 = CreateWorkOrder(_testAccountId, property, "Rewire panel", vendor2);

        var allWorkOrders = workOrdersVendor1.Concat(new[] { workOrderVendor2 }).ToList();
        SetupWorkOrdersDbSet(allWorkOrders);

        var query = new GetWorkOrdersByVendorQuery(vendor1.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(w => w.VendorId == vendor1.Id);
    }

    [Fact]
    public async Task Handle_RespectsTenantIsolation()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "My Property");
        var vendor = CreateVendor(_testAccountId, "John", "Plumber");

        var myWorkOrder = CreateWorkOrder(_testAccountId, property, "My work order", vendor);
        var otherTenantWorkOrder = CreateWorkOrder(_otherAccountId, property, "Other tenant work order", vendor);
        otherTenantWorkOrder.VendorId = vendor.Id; // Same vendor ID but different account

        var workOrders = new List<WorkOrder> { myWorkOrder, otherTenantWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByVendorQuery(vendor.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Description.Should().Be("My work order");
    }

    [Fact]
    public async Task Handle_ExcludesSoftDeletedWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var vendor = CreateVendor(_testAccountId, "John", "Plumber");

        var activeWorkOrder = CreateWorkOrder(_testAccountId, property, "Active work order", vendor);
        var deletedWorkOrder = CreateWorkOrder(_testAccountId, property, "Deleted work order", vendor);
        deletedWorkOrder.DeletedAt = DateTime.UtcNow;

        var workOrders = new List<WorkOrder> { activeWorkOrder, deletedWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByVendorQuery(vendor.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Description.Should().Be("Active work order");
    }

    [Fact]
    public async Task Handle_RespectsLimitParameter()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var vendor = CreateVendor(_testAccountId, "John", "Plumber");

        var workOrders = new List<WorkOrder>();
        for (int i = 1; i <= 10; i++)
        {
            var wo = CreateWorkOrder(_testAccountId, property, $"Work order {i}", vendor);
            wo.CreatedAt = DateTime.UtcNow.AddDays(-i);
            workOrders.Add(wo);
        }
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByVendorQuery(vendor.Id, Limit: 5);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(5);
        result.TotalCount.Should().Be(10);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyWhenVendorHasNoWorkOrders()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var vendorWithWorkOrders = CreateVendor(_testAccountId, "John", "Plumber");
        var vendorWithoutWorkOrders = CreateVendor(_testAccountId, "Jane", "Electrician");

        var workOrders = new List<WorkOrder>
        {
            CreateWorkOrder(_testAccountId, property, "Some work", vendorWithWorkOrders)
        };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByVendorQuery(vendorWithoutWorkOrders.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_OrdersByCreatedAtDescending()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property");
        var vendor = CreateVendor(_testAccountId, "John", "Plumber");

        var oldWorkOrder = CreateWorkOrder(_testAccountId, property, "Old work order", vendor);
        oldWorkOrder.CreatedAt = DateTime.UtcNow.AddDays(-7);

        var newWorkOrder = CreateWorkOrder(_testAccountId, property, "New work order", vendor);
        newWorkOrder.CreatedAt = DateTime.UtcNow;

        var middleWorkOrder = CreateWorkOrder(_testAccountId, property, "Middle work order", vendor);
        middleWorkOrder.CreatedAt = DateTime.UtcNow.AddDays(-3);

        var workOrders = new List<WorkOrder> { oldWorkOrder, newWorkOrder, middleWorkOrder };
        SetupWorkOrdersDbSet(workOrders);

        var query = new GetWorkOrdersByVendorQuery(vendor.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].Description.Should().Be("New work order");
        result.Items[1].Description.Should().Be("Middle work order");
        result.Items[2].Description.Should().Be("Old work order");
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

    private WorkOrder CreateWorkOrder(Guid accountId, Property property, string description, Vendor? vendor = null)
    {
        return new WorkOrder
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = property.Id,
            Property = property,
            VendorId = vendor?.Id,
            Vendor = vendor,
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
        var mockDbSet = workOrders.BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }
}
