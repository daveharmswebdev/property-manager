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
/// Unit tests for DeleteMaintenanceRequestPhotoHandler (AC #6, #8).
/// Tests primary promotion when primary photo is deleted.
/// Tests tenant property scoping on delete.
/// </summary>
public class DeleteMaintenanceRequestPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly DeleteMaintenanceRequestPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testRequestId = Guid.NewGuid();
    private List<MaintenanceRequestPhoto> _photos = new();

    public DeleteMaintenanceRequestPhotoHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        _photoServiceMock.Setup(x => x.DeletePhotoAsync(
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _handler = new DeleteMaintenanceRequestPhotoHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_DeletesPhotoFromDbAndCallsDeletePhotoAsync()
    {
        // Arrange
        var photo = CreatePhoto(_testAccountId, _testRequestId, isPrimary: true, displayOrder: 0);

        _photos = new List<MaintenanceRequestPhoto> { photo };
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { CreateMaintenanceRequest(_testAccountId, _testPropertyId) });
        SetupPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteMaintenanceRequestPhotoCommand(_testRequestId, photo.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        _photos = new List<MaintenanceRequestPhoto>();
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { CreateMaintenanceRequest(_testAccountId, _testPropertyId) });
        SetupPhotosDbSet(_photos);

        var command = new DeleteMaintenanceRequestPhotoCommand(_testRequestId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DeletePrimaryPhoto_PromotesNextPhotoByDisplayOrder()
    {
        // Arrange
        var photo1 = CreatePhoto(_testAccountId, _testRequestId, isPrimary: true, displayOrder: 0);
        var photo2 = CreatePhoto(_testAccountId, _testRequestId, isPrimary: false, displayOrder: 1);
        var photo3 = CreatePhoto(_testAccountId, _testRequestId, isPrimary: false, displayOrder: 2);

        _photos = new List<MaintenanceRequestPhoto> { photo1, photo2, photo3 };
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { CreateMaintenanceRequest(_testAccountId, _testPropertyId) });
        SetupPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteMaintenanceRequestPhotoCommand(_testRequestId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo2.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_DeleteOnlyPhoto_NoPromotionNeeded()
    {
        // Arrange
        var photo1 = CreatePhoto(_testAccountId, _testRequestId, isPrimary: true, displayOrder: 0);

        _photos = new List<MaintenanceRequestPhoto> { photo1 };
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { CreateMaintenanceRequest(_testAccountId, _testPropertyId) });
        SetupPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteMaintenanceRequestPhotoCommand(_testRequestId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_TenantAccessingRequestOnDifferentProperty_ThrowsNotFoundException()
    {
        // Arrange
        var tenantPropertyId = Guid.NewGuid();
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.PropertyId).Returns(tenantPropertyId);

        var photo = CreatePhoto(_testAccountId, _testRequestId, isPrimary: true, displayOrder: 0);
        _photos = new List<MaintenanceRequestPhoto> { photo };

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { CreateMaintenanceRequest(_testAccountId, _testPropertyId) });
        SetupPhotosDbSet(_photos);

        var command = new DeleteMaintenanceRequestPhotoCommand(_testRequestId, photo.Id);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_MaintenanceRequestNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest>());

        var command = new DeleteMaintenanceRequestPhotoCommand(Guid.NewGuid(), Guid.NewGuid());

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

    private void SetupPhotosDbSet(List<MaintenanceRequestPhoto> photos)
    {
        var mockDbSet = photos.BuildMockDbSet();

        mockDbSet.Setup(m => m.Remove(It.IsAny<MaintenanceRequestPhoto>()))
            .Callback<MaintenanceRequestPhoto>(p => _photos.Remove(p));

        _dbContextMock.Setup(x => x.MaintenanceRequestPhotos).Returns(mockDbSet.Object);
    }

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
