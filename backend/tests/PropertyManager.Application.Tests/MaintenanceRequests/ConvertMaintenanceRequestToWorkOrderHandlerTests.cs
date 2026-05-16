using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequests;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for ConvertMaintenanceRequestToWorkOrderCommandHandler (Story 20.8, AC #5, #6, #10, #12, #13, #14, #15).
/// </summary>
public class ConvertMaintenanceRequestToWorkOrderHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<DatabaseFacade> _databaseMock;
    private readonly Mock<IDbContextTransaction> _transactionMock;
    private readonly ConvertMaintenanceRequestToWorkOrderCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly List<WorkOrder> _addedWorkOrders = new();
    private readonly List<WorkOrderPhoto> _addedWorkOrderPhotos = new();

    public ConvertMaintenanceRequestToWorkOrderHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        // Transaction mock
        _transactionMock = new Mock<IDbContextTransaction>();
        _transactionMock.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _transactionMock.Setup(x => x.RollbackAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _transactionMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        _databaseMock = new Mock<DatabaseFacade>(Mock.Of<DbContext>());
        _databaseMock.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(_transactionMock.Object);
        _dbContextMock.Setup(x => x.Database).Returns(_databaseMock.Object);

        // WorkOrders DbSet — track Add
        var workOrders = new List<WorkOrder>();
        var workOrderSet = workOrders.BuildMockDbSet();
        workOrderSet.Setup(x => x.Add(It.IsAny<WorkOrder>()))
            .Callback<WorkOrder>(w => _addedWorkOrders.Add(w));
        _dbContextMock.Setup(x => x.WorkOrders).Returns(workOrderSet.Object);

        // WorkOrderPhotos DbSet — track Add
        var workOrderPhotos = new List<WorkOrderPhoto>();
        var workOrderPhotoSet = workOrderPhotos.BuildMockDbSet();
        workOrderPhotoSet.Setup(x => x.Add(It.IsAny<WorkOrderPhoto>()))
            .Callback<WorkOrderPhoto>(p => _addedWorkOrderPhotos.Add(p));
        _dbContextMock.Setup(x => x.WorkOrderPhotos).Returns(workOrderPhotoSet.Object);

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new ConvertMaintenanceRequestToWorkOrderCommandHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            Mock.Of<ILogger<ConvertMaintenanceRequestToWorkOrderCommandHandler>>());
    }

    // ──────────────────────────────────────────────────────────────────
    // AC #5 / #6: happy-path conversion + photo mirroring
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ValidRequest_CreatesWorkOrderWithExpectedFields()
    {
        var requestId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);
        SetupCategoryExists(categoryId);
        SetupVendorExists(vendorId, _testAccountId);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(
            requestId, "  Fix leaky faucet  ", categoryId, vendorId);

        var response = await _handler.Handle(command, CancellationToken.None);

        _addedWorkOrders.Should().HaveCount(1);
        var wo = _addedWorkOrders[0];
        wo.AccountId.Should().Be(_testAccountId);
        wo.PropertyId.Should().Be(_testPropertyId);
        wo.Description.Should().Be("Fix leaky faucet");
        wo.Status.Should().Be(WorkOrderStatus.Reported);
        wo.CategoryId.Should().Be(categoryId);
        wo.VendorId.Should().Be(vendorId);
        wo.CreatedByUserId.Should().Be(_testUserId);

        response.WorkOrderId.Should().Be(wo.Id);
        response.MaintenanceRequestId.Should().Be(requestId);
    }

    [Fact]
    public async Task Handle_ValidRequest_SetsMaintenanceRequestWorkOrderIdAndStatus()
    {
        var requestId = Guid.NewGuid();
        var maintenanceRequest = SetupMaintenanceRequest(
            requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, null);

        await _handler.Handle(command, CancellationToken.None);

        maintenanceRequest.WorkOrderId.Should().Be(_addedWorkOrders[0].Id);
        maintenanceRequest.Status.Should().Be(MaintenanceRequestStatus.InProgress);
    }

    [Fact]
    public async Task Handle_WithPhotos_CreatesMirroredWorkOrderPhotos()
    {
        var requestId = Guid.NewGuid();
        var photos = new List<MaintenanceRequestPhoto>
        {
            new()
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                MaintenanceRequestId = requestId,
                StorageKey = "accounts/x/maintenance-requests/r1/photo1.jpg",
                ThumbnailStorageKey = "accounts/x/maintenance-requests/r1/photo1-thumb.jpg",
                OriginalFileName = "photo1.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 12345,
                DisplayOrder = 0,
                IsPrimary = true,
                CreatedByUserId = _testUserId,
            },
            new()
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                MaintenanceRequestId = requestId,
                StorageKey = "accounts/x/maintenance-requests/r1/photo2.jpg",
                ThumbnailStorageKey = null,
                OriginalFileName = "photo2.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 67890,
                DisplayOrder = 1,
                IsPrimary = false,
                CreatedByUserId = _testUserId,
            },
        };
        SetupMaintenanceRequest(
            requestId,
            _testAccountId,
            _testPropertyId,
            MaintenanceRequestStatus.Submitted,
            photos);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, null);

        await _handler.Handle(command, CancellationToken.None);

        _addedWorkOrderPhotos.Should().HaveCount(2);
        var wo = _addedWorkOrders[0];

        var mirroredPrimary = _addedWorkOrderPhotos.Single(p => p.IsPrimary);
        mirroredPrimary.AccountId.Should().Be(_testAccountId);
        mirroredPrimary.WorkOrderId.Should().Be(wo.Id);
        mirroredPrimary.StorageKey.Should().Be("accounts/x/maintenance-requests/r1/photo1.jpg");
        mirroredPrimary.ThumbnailStorageKey.Should().Be("accounts/x/maintenance-requests/r1/photo1-thumb.jpg");
        mirroredPrimary.OriginalFileName.Should().Be("photo1.jpg");
        mirroredPrimary.ContentType.Should().Be("image/jpeg");
        mirroredPrimary.FileSizeBytes.Should().Be(12345);
        mirroredPrimary.DisplayOrder.Should().Be(0);
        mirroredPrimary.CreatedByUserId.Should().Be(_testUserId);

        var mirroredSecondary = _addedWorkOrderPhotos.Single(p => !p.IsPrimary);
        mirroredSecondary.StorageKey.Should().Be("accounts/x/maintenance-requests/r1/photo2.jpg");
        mirroredSecondary.DisplayOrder.Should().Be(1);
        mirroredSecondary.ThumbnailStorageKey.Should().BeNull();
    }

    [Fact]
    public async Task Handle_NoPhotos_NoWorkOrderPhotosAdded()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, null);

        await _handler.Handle(command, CancellationToken.None);

        _addedWorkOrderPhotos.Should().BeEmpty();
    }

    // ──────────────────────────────────────────────────────────────────
    // AC #12 / #13: not-found
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_RequestNotFound_ThrowsNotFoundException()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequests(new List<MaintenanceRequest>());

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, null);

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*MaintenanceRequest*{requestId}*");
    }

    [Fact]
    public async Task Handle_InvalidCategory_ThrowsNotFoundException()
    {
        var requestId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);
        SetupCategories(new List<ExpenseCategory>()); // empty

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", categoryId, null);

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*ExpenseCategory*{categoryId}*");
    }

    [Fact]
    public async Task Handle_InvalidVendor_ThrowsNotFoundException()
    {
        var requestId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);
        SetupVendors(new List<Vendor>());

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, vendorId);

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Vendor*{vendorId}*");
    }

    [Fact]
    public async Task Handle_VendorFromOtherAccount_ThrowsNotFoundException()
    {
        var requestId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);

        // Vendor exists but belongs to a different account — predicate filters it out.
        var otherAccount = Guid.NewGuid();
        var vendors = new List<Vendor>
        {
            new() { Id = vendorId, AccountId = otherAccount }
        };
        SetupVendors(vendors);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, vendorId);

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    // ──────────────────────────────────────────────────────────────────
    // AC #10: state-machine enforcement
    // ──────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(MaintenanceRequestStatus.InProgress)]
    [InlineData(MaintenanceRequestStatus.Resolved)]
    [InlineData(MaintenanceRequestStatus.Dismissed)]
    public async Task Handle_RequestNotInSubmittedStatus_ThrowsBusinessRuleException(
        MaintenanceRequestStatus sourceStatus)
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, sourceStatus);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, null);

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage($"*{sourceStatus}*InProgress*");

        // The transaction was opened (WO insert happened) but commit was NOT called.
        _databaseMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _transactionMock.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ──────────────────────────────────────────────────────────────────
    // Misc
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_TrimsDescription()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(
            requestId, "  Fix sink  ", null, null);

        await _handler.Handle(command, CancellationToken.None);

        _addedWorkOrders[0].Description.Should().Be("Fix sink");
    }

    [Fact]
    public async Task Handle_PersistsViaTwoSaveChangesCalls()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, _testPropertyId, MaintenanceRequestStatus.Submitted);

        var command = new ConvertMaintenanceRequestToWorkOrderCommand(requestId, "Fix it", null, null);

        await _handler.Handle(command, CancellationToken.None);

        _dbContextMock.Verify(
            x => x.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Exactly(2));
        _transactionMock.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ──────────────────────────────────────────────────────────────────
    // Setup helpers
    // ──────────────────────────────────────────────────────────────────

    private MaintenanceRequest SetupMaintenanceRequest(
        Guid id,
        Guid accountId,
        Guid propertyId,
        MaintenanceRequestStatus status,
        List<MaintenanceRequestPhoto>? photos = null)
    {
        var entity = new MaintenanceRequest
        {
            Id = id,
            AccountId = accountId,
            PropertyId = propertyId,
            SubmittedByUserId = _testUserId,
            Description = "seeded",
            Status = status,
            DeletedAt = null,
            Photos = photos ?? new List<MaintenanceRequestPhoto>(),
        };
        SetupMaintenanceRequests(new List<MaintenanceRequest> { entity });
        return entity;
    }

    private void SetupMaintenanceRequests(List<MaintenanceRequest> requests)
    {
        var mockDbSet = requests.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }

    private void SetupCategoryExists(Guid categoryId)
    {
        SetupCategories(new List<ExpenseCategory>
        {
            new() { Id = categoryId, Name = "Repairs" }
        });
    }

    private void SetupCategories(List<ExpenseCategory> categories)
    {
        var mockDbSet = categories.BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }

    private void SetupVendorExists(Guid vendorId, Guid accountId)
    {
        SetupVendors(new List<Vendor>
        {
            new() { Id = vendorId, AccountId = accountId }
        });
    }

    private void SetupVendors(List<Vendor> vendors)
    {
        var mockDbSet = vendors.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }
}
