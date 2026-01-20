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
/// Unit tests for UpdateWorkOrderCommandHandler (AC #6, #7).
/// </summary>
public class UpdateWorkOrderHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly UpdateWorkOrderCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public UpdateWorkOrderHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new UpdateWorkOrderCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_UpdatesWorkOrder()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupCategoryExists(categoryId);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            categoryId,
            "Assigned",
            null, // VendorId
            null); // TagIds

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Description.Should().Be("Updated description");
        workOrder.CategoryId.Should().Be(categoryId);
        workOrder.Status.Should().Be(WorkOrderStatus.Assigned);
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        SetupWorkOrderNotFound();

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*WorkOrder*{workOrderId}*");
    }

    [Fact]
    public async Task Handle_WorkOrderFromDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _otherAccountId);
        // The handler uses account filter, so different account's work order won't be found
        SetupWorkOrderNotFound();

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_CategoryNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupCategoryNotFound();

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            categoryId,
            null,
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*ExpenseCategory*{categoryId}*");
    }

    [Fact]
    public async Task Handle_WithValidTags_UpdatesTagAssignments()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var tag1Id = Guid.NewGuid();
        var tag2Id = Guid.NewGuid();
        var oldTagId = Guid.NewGuid();

        var existingAssignment = new WorkOrderTagAssignment { WorkOrderId = workOrderId, TagId = oldTagId };
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        workOrder.TagAssignments.Add(existingAssignment);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(new[] { tag1Id, tag2Id }, _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment> { existingAssignment });

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            new List<Guid> { tag1Id, tag2Id });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.TagAssignments.Should().HaveCount(2);
        workOrder.TagAssignments.Should().Contain(a => a.TagId == tag1Id);
        workOrder.TagAssignments.Should().Contain(a => a.TagId == tag2Id);
        workOrder.TagAssignments.Should().NotContain(a => a.TagId == oldTagId);
    }

    [Fact]
    public async Task Handle_WithEmptyTags_RemovesAllTagAssignments()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var oldTagId = Guid.NewGuid();

        var existingAssignment = new WorkOrderTagAssignment { WorkOrderId = workOrderId, TagId = oldTagId };
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        workOrder.TagAssignments.Add(existingAssignment);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment> { existingAssignment });

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            new List<Guid>()); // Empty list

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.TagAssignments.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_WithInvalidTagId_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var invalidTagId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId); // No tags exist
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            new List<Guid> { invalidTagId });

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*WorkOrderTag*{invalidTagId}*");
    }

    [Fact]
    public async Task Handle_WithNullTags_DoesNotModifyExistingTags()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var existingTagId = Guid.NewGuid();

        var existingAssignment = new WorkOrderTagAssignment { WorkOrderId = workOrderId, TagId = existingTagId };
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        workOrder.TagAssignments.Add(existingAssignment);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment> { existingAssignment });

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            null); // null means don't modify

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.TagAssignments.Should().HaveCount(1);
        workOrder.TagAssignments.Should().Contain(a => a.TagId == existingTagId);
    }

    [Theory]
    [InlineData("reported", WorkOrderStatus.Reported)]
    [InlineData("ASSIGNED", WorkOrderStatus.Assigned)]
    [InlineData("Completed", WorkOrderStatus.Completed)]
    public async Task Handle_StatusParsing_IsCaseInsensitive(string statusInput, WorkOrderStatus expectedStatus)
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            statusInput,
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Status.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task Handle_TrimsDescription()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "  Updated description  ",
            null,
            null,
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Description.Should().Be("Updated description");
    }

    [Fact]
    public async Task Handle_CallsSaveChangesAsync()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    #region Vendor Validation Tests

    [Fact]
    public async Task Handle_WithValidVendor_UpdatesVendorId()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupVendorExists(vendorId, _testAccountId);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            vendorId,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.VendorId.Should().Be(vendorId);
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupVendorNotFound();

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            vendorId,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Vendor*{vendorId}*");
    }

    [Fact]
    public async Task Handle_VendorFromDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        // Vendor exists but belongs to different account
        SetupVendorExists(vendorId, _otherAccountId);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            vendorId,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Vendor*{vendorId}*");
    }

    [Fact]
    public async Task Handle_WithNullVendorId_ClearsVendor()
    {
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        workOrder.VendorId = Guid.NewGuid(); // Set an existing vendor
        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Updated description",
            null,
            null,
            null, // Clear vendor
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.VendorId.Should().BeNull();
    }

    #endregion

    private WorkOrder CreateWorkOrder(Guid id, Guid accountId)
    {
        return new WorkOrder
        {
            Id = id,
            AccountId = accountId,
            PropertyId = Guid.NewGuid(),
            Description = "Original description",
            Status = WorkOrderStatus.Reported,
            CreatedByUserId = _testUserId,
            TagAssignments = new List<WorkOrderTagAssignment>()
        };
    }

    private void SetupWorkOrderExists(WorkOrder workOrder)
    {
        var workOrders = new List<WorkOrder> { workOrder };
        var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private void SetupWorkOrderNotFound()
    {
        var workOrders = new List<WorkOrder>();
        var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private void SetupCategoryExists(Guid categoryId)
    {
        var categories = new List<ExpenseCategory>
        {
            new ExpenseCategory { Id = categoryId, Name = "Repairs" }
        };
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }

    private void SetupCategoryNotFound()
    {
        var categories = new List<ExpenseCategory>();
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }

    private void SetupTagsExist(IEnumerable<Guid> tagIds, Guid accountId)
    {
        var tags = tagIds.Select(id => new WorkOrderTag
        {
            Id = id,
            AccountId = accountId,
            Name = $"Tag-{id.ToString().Substring(0, 8)}",
            CreatedAt = DateTime.UtcNow
        }).ToList();
        var mockDbSet = tags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderTags).Returns(mockDbSet.Object);
    }

    private void SetupTagAssignmentsDbSet(List<WorkOrderTagAssignment> assignments)
    {
        var mockDbSet = assignments.AsQueryable().BuildMockDbSet();
        mockDbSet.Setup(x => x.RemoveRange(It.IsAny<IEnumerable<WorkOrderTagAssignment>>()))
            .Callback<IEnumerable<WorkOrderTagAssignment>>(items =>
            {
                foreach (var item in items.ToList())
                {
                    assignments.Remove(item);
                }
            });
        _dbContextMock.Setup(x => x.WorkOrderTagAssignments).Returns(mockDbSet.Object);
    }

    private void SetupVendorExists(Guid vendorId, Guid accountId)
    {
        var vendors = new List<Vendor>
        {
            new Vendor { Id = vendorId, AccountId = accountId, FirstName = "Test", LastName = "Vendor" }
        };
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }

    private void SetupVendorNotFound()
    {
        var vendors = new List<Vendor>();
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }
}
