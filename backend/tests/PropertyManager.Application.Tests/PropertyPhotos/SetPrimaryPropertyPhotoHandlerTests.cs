using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.PropertyPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for SetPrimaryPropertyPhotoHandler (AC-13.3a.6).
/// Tests setting photo as primary and clearing previous primary.
/// </summary>
public class SetPrimaryPropertyPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly SetPrimaryPropertyPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public SetPrimaryPropertyPhotoHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new SetPrimaryPropertyPhotoHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_SetNewPrimary_ClearsPreviousPrimary()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1);

        var photos = new List<PropertyPhoto> { photo1, photo2 };
        SetupPropertyPhotosDbSet(photos);
        SetupSaveChanges();

        var command = new SetPrimaryPropertyPhotoCommand(_testPropertyId, photo2.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo1.IsPrimary.Should().BeFalse();
        photo2.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_SetAlreadyPrimary_NoChanges()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1);

        var photos = new List<PropertyPhoto> { photo1, photo2 };
        SetupPropertyPhotosDbSet(photos);
        SetupSaveChanges();

        var command = new SetPrimaryPropertyPhotoCommand(_testPropertyId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - No changes should be made
        photo1.IsPrimary.Should().BeTrue();
        photo2.IsPrimary.Should().BeFalse();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var photos = new List<PropertyPhoto>();
        SetupPropertyPhotosDbSet(photos);

        var command = new SetPrimaryPropertyPhotoCommand(_testPropertyId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentProperty_ThrowsNotFoundException()
    {
        // Arrange
        var otherPropertyId = Guid.NewGuid();
        var photo = CreatePropertyPhoto(_testAccountId, otherPropertyId, isPrimary: true, displayOrder: 0);

        var photos = new List<PropertyPhoto> { photo };
        SetupPropertyPhotosDbSet(photos);

        var command = new SetPrimaryPropertyPhotoCommand(_testPropertyId, photo.Id); // Different property

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

        var photos = new List<PropertyPhoto> { photo };
        SetupPropertyPhotosDbSet(photos);

        var command = new SetPrimaryPropertyPhotoCommand(_testPropertyId, photo.Id);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_NoPreviousPrimary_SetsNewPrimary()
    {
        // Arrange - No primary photo exists (edge case)
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1);

        var photos = new List<PropertyPhoto> { photo1, photo2 };
        SetupPropertyPhotosDbSet(photos);
        SetupSaveChanges();

        var command = new SetPrimaryPropertyPhotoCommand(_testPropertyId, photo2.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo2.IsPrimary.Should().BeTrue();
        photo1.IsPrimary.Should().BeFalse();
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
        _dbContextMock.Setup(x => x.PropertyPhotos).Returns(mockDbSet.Object);
    }

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
