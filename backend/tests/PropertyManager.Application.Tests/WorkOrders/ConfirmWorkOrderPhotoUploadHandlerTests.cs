using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for ConfirmWorkOrderPhotoUploadHandler (AC #4).
/// Tests photo record creation and thumbnail generation trigger.
/// </summary>
public class ConfirmWorkOrderPhotoUploadHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly ConfirmWorkOrderPhotoUploadHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public ConfirmWorkOrderPhotoUploadHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new ConfirmWorkOrderPhotoUploadHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_CreatesPhotoRecord()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var storageKey = $"{_testAccountId}/workorders/2026/test.jpg";
        var thumbnailKey = $"{_testAccountId}/workorders/2026/test_thumb.jpg";

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());
        SetupPhotoServiceMock(storageKey, thumbnailKey);
        SetupWorkOrderPhotosAdd();

        var command = new ConfirmWorkOrderPhotoUploadCommand(
            _testWorkOrderId,
            storageKey,
            thumbnailKey,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        // Note: ID is assigned by EF Core during save, so we verify the Add call instead
        _dbContextMock.Verify(x => x.WorkOrderPhotos.Add(It.Is<WorkOrderPhoto>(p =>
            p.AccountId == _testAccountId &&
            p.WorkOrderId == _testWorkOrderId &&
            p.StorageKey == storageKey &&
            p.OriginalFileName == "test.jpg" &&
            p.CreatedByUserId == _testUserId)), Times.Once);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidRequest_TriggersThumbnailGeneration()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var storageKey = $"{_testAccountId}/workorders/2026/test.jpg";
        var thumbnailKey = $"{_testAccountId}/workorders/2026/test_thumb.jpg";

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());
        SetupPhotoServiceMock(storageKey, thumbnailKey);
        SetupWorkOrderPhotosAdd();

        var command = new ConfirmWorkOrderPhotoUploadCommand(
            _testWorkOrderId,
            storageKey,
            thumbnailKey,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.ConfirmUploadAsync(
            It.Is<ConfirmPhotoUploadRequest>(r =>
                r.StorageKey == storageKey &&
                r.ThumbnailStorageKey == thumbnailKey),
            "image/jpeg",
            1024,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/workorders/2026/test.jpg";
        var thumbnailKey = $"{_testAccountId}/workorders/2026/test_thumb.jpg";

        SetupWorkOrdersDbSet(new List<WorkOrder>()); // No work orders

        var command = new ConfirmWorkOrderPhotoUploadCommand(
            Guid.NewGuid(),
            storageKey,
            thumbnailKey,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_InvalidStorageKeyFormat_ThrowsArgumentException()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });

        var command = new ConfirmWorkOrderPhotoUploadCommand(
            _testWorkOrderId,
            "invalid-key", // Invalid format
            "thumbnail-key",
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_StorageKeyForDifferentAccount_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var otherAccountId = Guid.NewGuid();
        var storageKey = $"{otherAccountId}/workorders/2026/test.jpg"; // Different account

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });

        var command = new ConfirmWorkOrderPhotoUploadCommand(
            _testWorkOrderId,
            storageKey,
            $"{otherAccountId}/workorders/2026/test_thumb.jpg",
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ReturnsPresignedUrls()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var storageKey = $"{_testAccountId}/workorders/2026/test.jpg";
        var thumbnailKey = $"{_testAccountId}/workorders/2026/test_thumb.jpg";
        var expectedViewUrl = "https://s3.amazonaws.com/bucket/view-url";
        var expectedThumbnailUrl = "https://s3.amazonaws.com/bucket/thumb-url";

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());
        SetupPhotoServiceMock(storageKey, thumbnailKey);
        SetupWorkOrderPhotosAdd();
        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedViewUrl);
        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedThumbnailUrl);

        var command = new ConfirmWorkOrderPhotoUploadCommand(
            _testWorkOrderId,
            storageKey,
            thumbnailKey,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.ViewUrl.Should().Be(expectedViewUrl);
        result.ThumbnailUrl.Should().Be(expectedThumbnailUrl);
    }

    private WorkOrder CreateWorkOrder(Guid accountId)
    {
        return new WorkOrder
        {
            Id = _testWorkOrderId,
            AccountId = accountId,
            PropertyId = Guid.NewGuid(),
            Description = "Test Work Order",
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

    private void SetupWorkOrderPhotosAdd()
    {
        _dbContextMock.Setup(x => x.WorkOrderPhotos.Add(It.IsAny<WorkOrderPhoto>()));
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }

    private void SetupPhotoServiceMock(string storageKey, string? thumbnailKey)
    {
        _photoServiceMock.Setup(x => x.ConfirmUploadAsync(
                It.IsAny<ConfirmPhotoUploadRequest>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoRecord(
                storageKey,
                thumbnailKey,
                "image/jpeg",
                1024));

        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/photo.jpg");

        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/thumbnail.jpg");
    }
}
