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
/// Unit tests for ConfirmMaintenanceRequestPhotoUploadHandler (AC #3).
/// Tests auto-primary logic for first photo.
/// </summary>
public class ConfirmMaintenanceRequestPhotoUploadHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly ConfirmMaintenanceRequestPhotoUploadHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testRequestId = Guid.NewGuid();

    public ConfirmMaintenanceRequestPhotoUploadHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        _handler = new ConfirmMaintenanceRequestPhotoUploadHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidConfirm_CreatesPhotoRecordAndReturnsIdWithUrls()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var storageKey = $"{_testAccountId}/maintenancerequests/2026/test-photo.jpg";

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());
        SetupPhotoServiceMock(storageKey);
        SetupPhotosAdd();

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            request.Id,
            storageKey,
            $"{_testAccountId}/maintenancerequests/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ViewUrl.Should().Be("https://example.com/photo.jpg");
        result.ThumbnailUrl.Should().Be("https://example.com/thumbnail.jpg");
    }

    [Fact]
    public async Task Handle_FirstPhotoForRequest_SetsIsPrimaryTrue()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var storageKey = $"{_testAccountId}/maintenancerequests/2026/test-photo.jpg";

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());
        SetupPhotoServiceMock(storageKey);
        SetupPhotosAdd();

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            request.Id,
            storageKey,
            $"{_testAccountId}/maintenancerequests/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.MaintenanceRequestPhotos.Add(It.Is<MaintenanceRequestPhoto>(
            p => p.IsPrimary == true && p.DisplayOrder == 0
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_SubsequentPhotos_SetsIsPrimaryFalse()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var existingPhoto = CreatePhoto(_testAccountId, request.Id, isPrimary: true, displayOrder: 0);
        var storageKey = $"{_testAccountId}/maintenancerequests/2026/test-photo.jpg";

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto> { existingPhoto });
        SetupPhotoServiceMock(storageKey);
        SetupPhotosAdd();

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            request.Id,
            storageKey,
            $"{_testAccountId}/maintenancerequests/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo-2.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.MaintenanceRequestPhotos.Add(It.Is<MaintenanceRequestPhoto>(
            p => p.IsPrimary == false && p.DisplayOrder == 1
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_MultipleExistingPhotos_SetsCorrectDisplayOrder()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var existingPhotos = new List<MaintenanceRequestPhoto>
        {
            CreatePhoto(_testAccountId, request.Id, isPrimary: true, displayOrder: 0),
            CreatePhoto(_testAccountId, request.Id, isPrimary: false, displayOrder: 1),
            CreatePhoto(_testAccountId, request.Id, isPrimary: false, displayOrder: 2)
        };
        var storageKey = $"{_testAccountId}/maintenancerequests/2026/test-photo.jpg";

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(existingPhotos);
        SetupPhotoServiceMock(storageKey);
        SetupPhotosAdd();

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            request.Id,
            storageKey,
            $"{_testAccountId}/maintenancerequests/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo-4.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.MaintenanceRequestPhotos.Add(It.Is<MaintenanceRequestPhoto>(
            p => p.DisplayOrder == 3
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidStorageKeyFormat_ThrowsArgumentException()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var storageKey = "invalid-storage-key";

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            request.Id,
            storageKey,
            "invalid-thumbnail-key",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_StorageKeyForDifferentAccount_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var otherAccountId = Guid.NewGuid();
        var storageKey = $"{otherAccountId}/maintenancerequests/2026/test-photo.jpg";

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            request.Id,
            storageKey,
            $"{otherAccountId}/maintenancerequests/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_MaintenanceRequestNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/maintenancerequests/2026/test-photo.jpg";
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest>());
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());

        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            Guid.NewGuid(),
            storageKey,
            $"{_testAccountId}/maintenancerequests/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

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

    private MaintenanceRequestPhoto CreatePhoto(Guid accountId, Guid requestId, bool isPrimary, int displayOrder)
    {
        return new MaintenanceRequestPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            MaintenanceRequestId = requestId,
            StorageKey = $"{accountId}/maintenancerequests/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/maintenancerequests/2026/thumbnails/{Guid.NewGuid()}.jpg",
            OriginalFileName = "photo.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            DisplayOrder = displayOrder,
            IsPrimary = isPrimary,
            CreatedByUserId = Guid.NewGuid(),
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

    private void SetupMaintenanceRequestPhotosDbSet(List<MaintenanceRequestPhoto> photos)
    {
        var mockDbSet = photos.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequestPhotos).Returns(mockDbSet.Object);
    }

    private void SetupPhotosAdd()
    {
        _dbContextMock.Setup(x => x.MaintenanceRequestPhotos.Add(It.IsAny<MaintenanceRequestPhoto>()));
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }

    private void SetupPhotoServiceMock(string storageKey)
    {
        _photoServiceMock.Setup(x => x.ConfirmUploadAsync(
                It.IsAny<ConfirmPhotoUploadRequest>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoRecord(
                storageKey,
                $"{_testAccountId}/maintenancerequests/2026/thumbnails/test.jpg",
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
