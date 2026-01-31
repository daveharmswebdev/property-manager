using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for DeleteWorkOrderPhotoHandler (AC #6).
/// Tests photo deletion from both S3 and database.
/// </summary>
public class DeleteWorkOrderPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly DeleteWorkOrderPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();
    private readonly Guid _testPhotoId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public DeleteWorkOrderPhotoHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new DeleteWorkOrderPhotoHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_DeletesPhotoFromDatabase()
    {
        // Arrange
        var photo = CreatePhoto(_testAccountId, _testWorkOrderId, withThumbnail: true);
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.WorkOrderPhotos.Remove(It.Is<WorkOrderPhoto>(p => p.Id == _testPhotoId)), Times.Once);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidRequest_DeletesPhotoFromS3()
    {
        // Arrange
        var photo = CreatePhoto(_testAccountId, _testWorkOrderId, withThumbnail: true);
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PhotoWithThumbnail_DeletesBothFromS3()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/workorders/2026/photo.jpg";
        var thumbnailKey = $"{_testAccountId}/workorders/2026/photo_thumb.jpg";
        var photo = new WorkOrderPhoto
        {
            Id = _testPhotoId,
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.DeletePhotoAsync(
            storageKey,
            thumbnailKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PhotoWithoutThumbnail_DeletesOnlyOriginalFromS3()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/workorders/2026/photo.jpg";
        var photo = new WorkOrderPhoto
        {
            Id = _testPhotoId,
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = storageKey,
            ThumbnailStorageKey = null, // No thumbnail
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.DeletePhotoAsync(
            storageKey,
            null,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>()); // No photos

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentWorkOrder_ThrowsNotFoundException()
    {
        // Arrange
        var photo = new WorkOrderPhoto
        {
            Id = _testPhotoId,
            AccountId = _testAccountId,
            WorkOrderId = Guid.NewGuid(), // Different work order
            StorageKey = "some/storage/key",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var photo = new WorkOrderPhoto
        {
            Id = _testPhotoId,
            AccountId = Guid.NewGuid(), // Different account
            WorkOrderId = _testWorkOrderId,
            StorageKey = "some/storage/key",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DeletesFromS3BeforeDatabase()
    {
        // Arrange
        var photo = CreatePhoto(_testAccountId, _testWorkOrderId, withThumbnail: true);
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var callOrder = new List<string>();
        _photoServiceMock.Setup(x => x.DeletePhotoAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("S3"))
            .Returns(Task.CompletedTask);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Callback(() => callOrder.Add("DB"))
            .ReturnsAsync(1);

        var command = new DeleteWorkOrderPhotoCommand(_testWorkOrderId, _testPhotoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        callOrder.Should().ContainInOrder("S3", "DB");
    }

    private WorkOrderPhoto CreatePhoto(Guid accountId, Guid workOrderId, bool withThumbnail = false)
    {
        return new WorkOrderPhoto
        {
            Id = _testPhotoId,
            AccountId = accountId,
            WorkOrderId = workOrderId,
            StorageKey = $"{accountId}/workorders/2026/photo.jpg",
            ThumbnailStorageKey = withThumbnail ? $"{accountId}/workorders/2026/photo_thumb.jpg" : null,
            OriginalFileName = "photo.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupWorkOrderPhotosDbSet(List<WorkOrderPhoto> photos)
    {
        var mockDbSet = photos.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderPhotos).Returns(mockDbSet.Object);
    }
}
