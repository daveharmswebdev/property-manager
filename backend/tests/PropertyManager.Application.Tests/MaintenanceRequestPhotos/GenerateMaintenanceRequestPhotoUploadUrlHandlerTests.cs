using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequestPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequestPhotos;

/// <summary>
/// Unit tests for GenerateMaintenanceRequestPhotoUploadUrlHandler (AC #2, #8).
/// Tests presigned URL generation for maintenance request photo uploads.
/// </summary>
public class GenerateMaintenanceRequestPhotoUploadUrlHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GenerateMaintenanceRequestPhotoUploadUrlHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testRequestId = Guid.NewGuid();

    public GenerateMaintenanceRequestPhotoUploadUrlHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        _handler = new GenerateMaintenanceRequestPhotoUploadUrlHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsUploadUrlDetails()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var expectedStorageKey = $"{_testAccountId}/maintenancerequests/2026/test.jpg";
        var expectedThumbnailKey = $"{_testAccountId}/maintenancerequests/2026/thumbnails/test.jpg";
        var expectedUploadUrl = "https://s3.amazonaws.com/bucket/presigned-url";
        var expectedExpiresAt = DateTime.UtcNow.AddMinutes(15);

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupPhotoServiceMock(expectedUploadUrl, expectedStorageKey, expectedThumbnailKey, expectedExpiresAt);

        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(
            _testRequestId,
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
    public async Task Handle_ValidRequest_CallsPhotoServiceWithMaintenanceRequestsEntityType()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupPhotoServiceMock();

        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(
            _testRequestId,
            "image/png",
            2048,
            "screenshot.png");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.Is<PhotoUploadRequest>(r =>
                r.EntityType == PhotoEntityType.MaintenanceRequests &&
                r.EntityId == _testRequestId &&
                r.ContentType == "image/png" &&
                r.FileSizeBytes == 2048 &&
                r.OriginalFileName == "screenshot.png"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_MaintenanceRequestNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest>());

        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DeletedMaintenanceRequest_ThrowsNotFoundException()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        request.DeletedAt = DateTime.UtcNow;

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });

        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(
            _testRequestId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_TenantAccessingRequestOnDifferentProperty_ThrowsNotFoundException()
    {
        // Arrange
        var tenantPropertyId = Guid.NewGuid();
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.PropertyId).Returns(tenantPropertyId);

        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId); // Different property
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });

        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(
            _testRequestId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    private MaintenanceRequest CreateMaintenanceRequest(Guid accountId, Guid propertyId)
    {
        return new MaintenanceRequest
        {
            Id = _testRequestId,
            AccountId = accountId,
            PropertyId = propertyId,
            SubmittedByUserId = Guid.NewGuid(),
            Description = "Test request",
            Status = MaintenanceRequestStatus.Submitted,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupMaintenanceRequestsDbSet(List<MaintenanceRequest> requests)
    {
        var filtered = requests
            .Where(r => r.AccountId == _testAccountId && r.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }

    private void SetupPhotoServiceMock(
        string uploadUrl = "https://s3.amazonaws.com/bucket/presigned-url",
        string storageKey = "account/maintenancerequests/2026/test.jpg",
        string thumbnailKey = "account/maintenancerequests/2026/thumbnails/test.jpg",
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
