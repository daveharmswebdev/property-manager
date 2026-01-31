using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GenerateWorkOrderPhotoUploadUrlHandler (AC #3).
/// Tests presigned URL generation for work order photo uploads.
/// </summary>
public class GenerateWorkOrderPhotoUploadUrlHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GenerateWorkOrderPhotoUploadUrlHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GenerateWorkOrderPhotoUploadUrlHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GenerateWorkOrderPhotoUploadUrlHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsUploadUrlDetails()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        var expectedStorageKey = $"{_testAccountId}/workorders/2026/test.jpg";
        var expectedThumbnailKey = $"{_testAccountId}/workorders/2026/test_thumb.jpg";
        var expectedUploadUrl = "https://s3.amazonaws.com/bucket/presigned-url";
        var expectedExpiresAt = DateTime.UtcNow.AddMinutes(15);

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupPhotoServiceMock(expectedUploadUrl, expectedStorageKey, expectedThumbnailKey, expectedExpiresAt);

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            _testWorkOrderId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().Be(expectedUploadUrl);
        result.StorageKey.Should().Be(expectedStorageKey);
        result.ThumbnailStorageKey.Should().Be(expectedThumbnailKey);
        result.ExpiresAt.Should().Be(expectedExpiresAt);
    }

    [Fact]
    public async Task Handle_ValidRequest_CallsPhotoServiceWithCorrectParameters()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupPhotoServiceMock();

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            _testWorkOrderId,
            "image/png",
            2048,
            "screenshot.png");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.Is<PhotoUploadRequest>(r =>
                r.EntityType == PhotoEntityType.WorkOrders &&
                r.EntityId == _testWorkOrderId &&
                r.ContentType == "image/png" &&
                r.FileSizeBytes == 2048 &&
                r.OriginalFileName == "screenshot.png"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WorkOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupWorkOrdersDbSet(new List<WorkOrder>()); // No work orders

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WorkOrderBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var workOrder = new WorkOrder
        {
            Id = _testWorkOrderId,
            AccountId = otherAccountId, // Different account
            PropertyId = Guid.NewGuid(),
            Description = "Other Work Order",
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            _testWorkOrderId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_UsesCorrectEntityType()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupPhotoServiceMock();

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            _testWorkOrderId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Verify PhotoEntityType.WorkOrders is used
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            It.IsAny<Guid>(),
            It.Is<PhotoUploadRequest>(r => r.EntityType == PhotoEntityType.WorkOrders),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    [InlineData("image/gif")]
    [InlineData("image/bmp")]
    [InlineData("image/tiff")]
    public async Task Handle_SupportedContentTypes_Succeeds(string contentType)
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupPhotoServiceMock();

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            _testWorkOrderId,
            contentType,
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Handle_PassesAccountIdToPhotoService()
    {
        // Arrange
        var workOrder = CreateWorkOrder(_testAccountId);
        SetupWorkOrdersDbSet(new List<WorkOrder> { workOrder });
        SetupPhotoServiceMock();

        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            _testWorkOrderId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Verify correct account ID is passed for tenant isolation
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.IsAny<PhotoUploadRequest>(),
            It.IsAny<CancellationToken>()), Times.Once);
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

    private void SetupPhotoServiceMock(
        string uploadUrl = "https://s3.amazonaws.com/bucket/presigned-url",
        string storageKey = "account/workorders/2026/test.jpg",
        string thumbnailKey = "account/workorders/2026/test_thumb.jpg",
        DateTime? expiresAt = null)
    {
        var expires = expiresAt ?? DateTime.UtcNow.AddMinutes(15);

        _photoServiceMock.Setup(x => x.GenerateUploadUrlAsync(
                It.IsAny<Guid>(),
                It.IsAny<PhotoUploadRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoUploadResult(
                uploadUrl,
                storageKey,
                thumbnailKey,
                expires));
    }
}
