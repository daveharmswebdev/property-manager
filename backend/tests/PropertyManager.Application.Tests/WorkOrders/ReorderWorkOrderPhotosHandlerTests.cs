using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for ReorderWorkOrderPhotosHandler (Story 10-6).
/// Tests photo reordering by updating DisplayOrder values.
/// </summary>
public class ReorderWorkOrderPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly ReorderWorkOrderPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public ReorderWorkOrderPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new ReorderWorkOrderPhotosHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_UpdatesDisplayOrder()
    {
        // Arrange
        var photo1Id = Guid.NewGuid();
        var photo2Id = Guid.NewGuid();
        var photo3Id = Guid.NewGuid();
        var photo1 = CreatePhoto(photo1Id, displayOrder: 0);
        var photo2 = CreatePhoto(photo2Id, displayOrder: 1);
        var photo3 = CreatePhoto(photo3Id, displayOrder: 2);

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo1, photo2, photo3 });

        // Reorder: move photo3 to first position
        var newOrder = new List<Guid> { photo3Id, photo1Id, photo2Id };
        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, newOrder);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo3.DisplayOrder.Should().Be(0);
        photo1.DisplayOrder.Should().Be(1);
        photo2.DisplayOrder.Should().Be(2);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReverseOrder_UpdatesAllDisplayOrders()
    {
        // Arrange
        var photo1Id = Guid.NewGuid();
        var photo2Id = Guid.NewGuid();
        var photo1 = CreatePhoto(photo1Id, displayOrder: 0);
        var photo2 = CreatePhoto(photo2Id, displayOrder: 1);

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo1, photo2 });

        // Reverse order
        var newOrder = new List<Guid> { photo2Id, photo1Id };
        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, newOrder);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo1.DisplayOrder.Should().Be(1);
        photo2.DisplayOrder.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupWorkOrdersDbSet(new List<WorkOrder>());
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());

        var command = new ReorderWorkOrderPhotosCommand(Guid.NewGuid(), new List<Guid> { Guid.NewGuid() });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WorkOrderBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var workOrder = new WorkOrder
        {
            Id = _testWorkOrderId,
            AccountId = Guid.NewGuid(), // Different account
            PropertyId = Guid.NewGuid(),
            Description = "Test",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());

        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, new List<Guid> { Guid.NewGuid() });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoIdNotInWorkOrder_ThrowsNotFoundException()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var unknownPhotoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, displayOrder: 0);

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        // Include an unknown photo ID
        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, new List<Guid> { photoId, unknownPhotoId });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_MissingPhotoId_ThrowsValidationException()
    {
        // Arrange
        var photo1Id = Guid.NewGuid();
        var photo2Id = Guid.NewGuid();
        var photo1 = CreatePhoto(photo1Id, displayOrder: 0);
        var photo2 = CreatePhoto(photo2Id, displayOrder: 1);

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo1, photo2 });

        // Only include one of the two photos
        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, new List<Guid> { photo1Id });

        // Act & Assert
        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DuplicatePhotoIds_ThrowsValidationException()
    {
        // Arrange
        var photo1Id = Guid.NewGuid();
        var photo2Id = Guid.NewGuid();
        var photo1 = CreatePhoto(photo1Id, displayOrder: 0);
        var photo2 = CreatePhoto(photo2Id, displayOrder: 1);

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo1, photo2 });

        // Include duplicate photo ID
        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, new List<Guid> { photo1Id, photo1Id });

        // Act & Assert
        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_SinglePhoto_UpdatesDisplayOrderToZero()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, displayOrder: 5); // Non-zero initial

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, new List<Guid> { photoId });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo.DisplayOrder.Should().Be(0);
    }

    [Fact]
    public async Task Handle_SameOrder_StillUpdatesDisplayOrder()
    {
        // Arrange
        var photo1Id = Guid.NewGuid();
        var photo2Id = Guid.NewGuid();
        var photo1 = CreatePhoto(photo1Id, displayOrder: 0);
        var photo2 = CreatePhoto(photo2Id, displayOrder: 1);

        var workOrder = CreateWorkOrder();
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo1, photo2 });

        // Same order as current
        var command = new ReorderWorkOrderPhotosCommand(_testWorkOrderId, new List<Guid> { photo1Id, photo2Id });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - should still save, order remains 0, 1
        photo1.DisplayOrder.Should().Be(0);
        photo2.DisplayOrder.Should().Be(1);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private WorkOrder CreateWorkOrder()
    {
        return new WorkOrder
        {
            Id = _testWorkOrderId,
            AccountId = _testAccountId,
            PropertyId = Guid.NewGuid(),
            Description = "Test Work Order",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private WorkOrderPhoto CreatePhoto(Guid photoId, int displayOrder)
    {
        return new WorkOrderPhoto
        {
            Id = photoId,
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = $"{_testAccountId}/workorders/2026/photo-{photoId}.jpg",
            OriginalFileName = $"photo-{photoId}.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            DisplayOrder = displayOrder,
            IsPrimary = displayOrder == 0,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupWorkOrdersDbSet(List<WorkOrder> workOrders)
    {
        var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
    }

    private void SetupWorkOrderPhotosDbSet(List<WorkOrderPhoto> photos)
    {
        var mockDbSet = photos.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderPhotos).Returns(mockDbSet.Object);
    }
}
