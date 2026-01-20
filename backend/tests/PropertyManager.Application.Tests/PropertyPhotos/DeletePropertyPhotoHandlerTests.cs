using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.PropertyPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for DeletePropertyPhotoHandler (AC-13.3a.5).
/// Tests primary promotion when primary photo is deleted.
/// </summary>
public class DeletePropertyPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly DeletePropertyPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private List<PropertyPhoto> _photos = new();

    public DeletePropertyPhotoHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _photoServiceMock.Setup(x => x.DeletePhotoAsync(
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _handler = new DeletePropertyPhotoHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_DeletePrimaryPhoto_PromotesNextPhotoByDisplayOrder()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1);
        var photo3 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 2);

        _photos = new List<PropertyPhoto> { photo1, photo2, photo3 };
        SetupPropertyPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeletePropertyPhotoCommand(_testPropertyId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - photo2 should be promoted to primary (lowest DisplayOrder after photo1 is removed)
        photo2.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_DeleteNonPrimaryPhoto_DoesNotPromoteOtherPhotos()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1);
        var photo3 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 2);

        _photos = new List<PropertyPhoto> { photo1, photo2, photo3 };
        SetupPropertyPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeletePropertyPhotoCommand(_testPropertyId, photo2.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - photo1 should remain primary, no promotion needed
        photo1.IsPrimary.Should().BeTrue();
        photo3.IsPrimary.Should().BeFalse();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once); // Only delete save
    }

    [Fact]
    public async Task Handle_DeleteOnlyPhoto_NoPromotionNeeded()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);

        _photos = new List<PropertyPhoto> { photo1 };
        SetupPropertyPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeletePropertyPhotoCommand(_testPropertyId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Only one save (the delete), no promotion
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_DeletePrimaryWithNonSequentialOrder_PromotesLowestDisplayOrder()
    {
        // Arrange - DisplayOrders are not sequential (could happen after reorder)
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 5);
        var photo3 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 3);

        _photos = new List<PropertyPhoto> { photo1, photo2, photo3 };
        SetupPropertyPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeletePropertyPhotoCommand(_testPropertyId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - photo3 (DisplayOrder=3) should be promoted, not photo2 (DisplayOrder=5)
        photo3.IsPrimary.Should().BeTrue();
        photo2.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        _photos = new List<PropertyPhoto>();
        SetupPropertyPhotosDbSet(_photos);

        var command = new DeletePropertyPhotoCommand(_testPropertyId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var photo = CreatePropertyPhoto(otherAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);

        _photos = new List<PropertyPhoto> { photo };
        SetupPropertyPhotosDbSet(_photos);

        var command = new DeletePropertyPhotoCommand(_testPropertyId, photo.Id);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DeletesFromS3()
    {
        // Arrange
        var photo = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);

        _photos = new List<PropertyPhoto> { photo };
        SetupPropertyPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeletePropertyPhotoCommand(_testPropertyId, photo.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private PropertyPhoto CreatePropertyPhoto(Guid accountId, Guid propertyId, bool isPrimary, int displayOrder)
    {
        return new PropertyPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = propertyId,
            StorageKey = $"{accountId}/properties/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/properties/2026/thumbnails/{Guid.NewGuid()}.jpg",
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

    private void SetupPropertyPhotosDbSet(List<PropertyPhoto> photos)
    {
        var mockDbSet = photos.AsQueryable().BuildMockDbSet();

        // Setup Remove to actually remove from list
        mockDbSet.Setup(m => m.Remove(It.IsAny<PropertyPhoto>()))
            .Callback<PropertyPhoto>(p => _photos.Remove(p));

        _dbContextMock.Setup(x => x.PropertyPhotos).Returns(mockDbSet.Object);
    }

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
