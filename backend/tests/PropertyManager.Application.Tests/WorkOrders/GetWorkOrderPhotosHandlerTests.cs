using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetWorkOrderPhotosHandler (AC #5).
/// Tests photo retrieval with presigned URLs.
/// </summary>
public class GetWorkOrderPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GetWorkOrderPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GetWorkOrderPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetWorkOrderPhotosHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsPhotosWithPresignedUrls()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var photos = new List<WorkOrderPhoto>
        {
            new WorkOrderPhoto
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                WorkOrderId = _testWorkOrderId,
                StorageKey = $"{_testAccountId}/workorders/2026/photo1.jpg",
                ThumbnailStorageKey = $"{_testAccountId}/workorders/2026/photo1_thumb.jpg",
                OriginalFileName = "photo1.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024,
                CreatedByUserId = _testUserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                UpdatedAt = DateTime.UtcNow.AddMinutes(-10)
            }
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(photos);
        SetupPhotoServiceUrlMocks();

        var query = new GetWorkOrderPhotosQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().HaveCount(1);
        result.Items[0].PhotoUrl.Should().NotBeNullOrEmpty();
        result.Items[0].ThumbnailUrl.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Handle_MultiplePhotos_SortsByDisplayOrderAscending()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var firstPhoto = new WorkOrderPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = $"{_testAccountId}/workorders/2026/first.jpg",
            OriginalFileName = "first.jpg",
            DisplayOrder = 0,
            IsPrimary = true,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddHours(-2),
            UpdatedAt = DateTime.UtcNow.AddHours(-2)
        };
        var secondPhoto = new WorkOrderPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = $"{_testAccountId}/workorders/2026/second.jpg",
            OriginalFileName = "second.jpg",
            DisplayOrder = 1,
            IsPrimary = false,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5), // Newer but higher DisplayOrder
            UpdatedAt = DateTime.UtcNow.AddMinutes(-5)
        };
        var thirdPhoto = new WorkOrderPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = $"{_testAccountId}/workorders/2026/third.jpg",
            OriginalFileName = "third.jpg",
            DisplayOrder = 2,
            IsPrimary = false,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            UpdatedAt = DateTime.UtcNow.AddHours(-1)
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        // Add in random order to verify sorting works
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { thirdPhoto, firstPhoto, secondPhoto });
        SetupPhotoServiceUrlMocks();

        var query = new GetWorkOrderPhotosQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].OriginalFileName.Should().Be("first.jpg"); // DisplayOrder 0
        result.Items[1].OriginalFileName.Should().Be("second.jpg"); // DisplayOrder 1
        result.Items[2].OriginalFileName.Should().Be("third.jpg"); // DisplayOrder 2
    }

    [Fact]
    public async Task Handle_NoPhotos_ReturnsEmptyList()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());

        var query = new GetWorkOrderPhotosQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupWorkOrdersDbSet(new List<WorkOrder>()); // No work orders
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());

        var query = new GetWorkOrderPhotosQuery(Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_IncludesThumbnailUrlWhenAvailable()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var photoWithThumbnail = new WorkOrderPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = $"{_testAccountId}/workorders/2026/photo.jpg",
            ThumbnailStorageKey = $"{_testAccountId}/workorders/2026/photo_thumb.jpg",
            OriginalFileName = "photo.jpg",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photoWithThumbnail });
        SetupPhotoServiceUrlMocks();

        var query = new GetWorkOrderPhotosQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items[0].ThumbnailUrl.Should().NotBeNullOrEmpty();
        _photoServiceMock.Verify(x => x.GetThumbnailUrlAsync(
            photoWithThumbnail.ThumbnailStorageKey!,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NoThumbnail_ReturnNullThumbnailUrl()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var photoWithoutThumbnail = new WorkOrderPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            WorkOrderId = _testWorkOrderId,
            StorageKey = $"{_testAccountId}/workorders/2026/photo.jpg",
            ThumbnailStorageKey = null, // No thumbnail
            OriginalFileName = "photo.jpg",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photoWithoutThumbnail });
        SetupPhotoServiceUrlMocks();

        var query = new GetWorkOrderPhotosQuery(_testWorkOrderId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items[0].ThumbnailUrl.Should().BeNull();
        _photoServiceMock.Verify(x => x.GetThumbnailUrlAsync(
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
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

    private void SetupPhotoServiceUrlMocks()
    {
        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://s3.amazonaws.com/bucket/view-url");
        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://s3.amazonaws.com/bucket/thumb-url");
    }
}
