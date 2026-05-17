using FluentAssertions;
using Microsoft.Extensions.Logging;
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
    private readonly Mock<ILogger<UpdateWorkOrderCommandHandler>> _loggerMock;
    private readonly UpdateWorkOrderCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public UpdateWorkOrderHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _loggerMock = new Mock<ILogger<UpdateWorkOrderCommandHandler>>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new UpdateWorkOrderCommandHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _loggerMock.Object);
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
        // Transitioning to Completed triggers the Story 20.10 sync lookup; seed an empty
        // MaintenanceRequests set so the FirstOrDefaultAsync returns null and the sync no-ops.
        SetupMaintenanceRequestsDbSet();

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

    #region Sync Resolution Tests (Story 20-10)

    [Fact]
    public async Task Handle_StatusChangedToCompleted_WithLinkedRequest_TransitionsRequestToResolved()
    {
        // AC #1 — Completed transition with linked InProgress request resolves it.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        // Prior status is Reported (from CreateWorkOrder) — transitioning to Completed.
        var linkedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.InProgress);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(linkedRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Status.Should().Be(WorkOrderStatus.Completed);
        linkedRequest.Status.Should().Be(MaintenanceRequestStatus.Resolved);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_NoLinkedRequest_DoesNotThrow_AndDoesNotMutateAnyRequest()
    {
        // AC #4, #13 — Unlinked WO completion succeeds and performs the lookup
        // (returns null) without throwing.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(); // empty — no linked request

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().NotThrowAsync();
        workOrder.Status.Should().Be(WorkOrderStatus.Completed);
        // The lookup IS made (returns null) — this proves AC #13 path.
        _dbContextMock.Verify(x => x.MaintenanceRequests, Times.AtLeastOnce);
    }

    [Fact]
    public async Task Handle_StatusChangedToAssigned_DoesNotQueryMaintenanceRequests()
    {
        // AC #2, #11 — Non-Completed transitions skip the lookup entirely.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        // workOrder.Status is Reported (from CreateWorkOrder)
        var linkedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.InProgress);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        // Intentionally do NOT setup MaintenanceRequests DbSet — accessing it would NRE
        // if the handler reached the lookup. That's the assertion we want.

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Assign it",
            null,
            "Assigned",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Status.Should().Be(WorkOrderStatus.Assigned);
        linkedRequest.Status.Should().Be(MaintenanceRequestStatus.InProgress);
        _dbContextMock.Verify(x => x.MaintenanceRequests, Times.Never);
    }

    [Fact]
    public async Task Handle_StatusUnchanged_Completed_DoesNotQueryMaintenanceRequests()
    {
        // AC #3 — Re-saving an already-Completed WO is a no-op for the sync.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        workOrder.Status = WorkOrderStatus.Completed; // priorStatus == Completed already
        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Tag tweak",
            null,
            "Completed",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Status.Should().Be(WorkOrderStatus.Completed);
        _dbContextMock.Verify(x => x.MaintenanceRequests, Times.Never);
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_LinkedRequestAlreadyResolved_DoesNotTransition()
    {
        // AC #8 — Defensive: linked request already Resolved is skipped (no re-transition).
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        var linkedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.Resolved);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(linkedRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().NotThrowAsync();
        workOrder.Status.Should().Be(WorkOrderStatus.Completed);
        linkedRequest.Status.Should().Be(MaintenanceRequestStatus.Resolved);
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_LinkedRequestDismissed_ThrowsBusinessRuleException()
    {
        // AC #7 — Dismissed source status cannot transition to Resolved.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        var linkedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.Dismissed);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(linkedRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*'Dismissed' to 'Resolved'*");
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_LinkedRequestSubmitted_ThrowsBusinessRuleException()
    {
        // AC #7 — Submitted source status cannot transition to Resolved.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        var linkedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.Submitted);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(linkedRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*'Submitted' to 'Resolved'*");
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_LinkedRequestFromDifferentAccount_DoesNotMutate()
    {
        // AC #1 + multi-tenancy — cross-account request must be excluded by the AccountId filter.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        var crossAccountRequest = CreateMaintenanceRequest(
            accountId: _otherAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.InProgress);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(crossAccountRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Status.Should().Be(WorkOrderStatus.Completed);
        // Cross-account row was filtered out — its status remains untouched.
        crossAccountRequest.Status.Should().Be(MaintenanceRequestStatus.InProgress);
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_LinkedRequestSoftDeleted_DoesNotMutate()
    {
        // Soft-deleted requests must be excluded by the DeletedAt == null filter.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        var softDeletedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.InProgress);
        softDeletedRequest.DeletedAt = DateTime.UtcNow;

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(softDeletedRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        workOrder.Status.Should().Be(WorkOrderStatus.Completed);
        softDeletedRequest.Status.Should().Be(MaintenanceRequestStatus.InProgress);
    }

    [Fact]
    public async Task Handle_StatusChangedToCompleted_LinkedRequestTransitions_LoggerCalledOnce()
    {
        // AC #9 — A single Information-level log entry mentioning "Linked maintenance request"
        // is emitted when the sync mutates a linked request.
        // Arrange
        var workOrderId = Guid.NewGuid();
        var workOrder = CreateWorkOrder(workOrderId, _testAccountId);
        var linkedRequest = CreateMaintenanceRequest(
            accountId: _testAccountId,
            workOrderId: workOrderId,
            status: MaintenanceRequestStatus.InProgress);

        SetupWorkOrderExists(workOrder);
        SetupTagsExist(Array.Empty<Guid>(), _testAccountId);
        SetupTagAssignmentsDbSet(new List<WorkOrderTagAssignment>());
        SetupMaintenanceRequestsDbSet(linkedRequest);

        var command = new UpdateWorkOrderCommand(
            workOrderId,
            "Job done",
            null,
            "Completed",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Linked maintenance request")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    private MaintenanceRequest CreateMaintenanceRequest(
        Guid accountId,
        Guid workOrderId,
        MaintenanceRequestStatus status)
    {
        return new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = Guid.NewGuid(),
            SubmittedByUserId = Guid.NewGuid(),
            WorkOrderId = workOrderId,
            Description = "test request",
            Status = status
        };
    }

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
        var mockDbSet = workOrders.BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private void SetupWorkOrderNotFound()
    {
        var workOrders = new List<WorkOrder>();
        var mockDbSet = workOrders.BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private void SetupCategoryExists(Guid categoryId)
    {
        var categories = new List<ExpenseCategory>
        {
            new ExpenseCategory { Id = categoryId, Name = "Repairs" }
        };
        var mockDbSet = categories.BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }

    private void SetupCategoryNotFound()
    {
        var categories = new List<ExpenseCategory>();
        var mockDbSet = categories.BuildMockDbSet();
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
        var mockDbSet = tags.BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderTags).Returns(mockDbSet.Object);
    }

    private void SetupTagAssignmentsDbSet(List<WorkOrderTagAssignment> assignments)
    {
        var mockDbSet = assignments.BuildMockDbSet();
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
        var mockDbSet = vendors.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }

    private void SetupVendorNotFound()
    {
        var vendors = new List<Vendor>();
        var mockDbSet = vendors.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }

    private void SetupMaintenanceRequestsDbSet(params MaintenanceRequest[] requests)
    {
        var list = requests.ToList();
        var mockDbSet = list.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }
}
