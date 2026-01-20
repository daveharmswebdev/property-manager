using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.PropertyPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for ConfirmPropertyPhotoUploadHandler (AC-13.3a.4).
/// Tests auto-primary logic for first photo.
/// </summary>
public class ConfirmPropertyPhotoUploadHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly ConfirmPropertyPhotoUploadHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public ConfirmPropertyPhotoUploadHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new ConfirmPropertyPhotoUploadHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_FirstPhotoForProperty_SetsIsPrimaryTrue()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var storageKey = $"{_testAccountId}/properties/2026/test-photo.jpg";

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>()); // No existing photos
        SetupPhotoServiceMock(storageKey);
        SetupPropertyPhotosAdd();

        var command = new ConfirmPropertyPhotoUploadCommand(
            property.Id,
            storageKey,
            $"{_testAccountId}/properties/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        // Note: ID is assigned by EF Core during save, so we verify the Add call instead

        _dbContextMock.Verify(x => x.PropertyPhotos.Add(It.Is<PropertyPhoto>(
            p => p.IsPrimary == true && p.DisplayOrder == 0
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_SecondPhotoForProperty_SetsIsPrimaryFalse()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var existingPhoto = CreatePropertyPhoto(_testAccountId, property.Id, isPrimary: true, displayOrder: 0);
        var storageKey = $"{_testAccountId}/properties/2026/test-photo.jpg";

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { existingPhoto });
        SetupPhotoServiceMock(storageKey);
        SetupPropertyPhotosAdd();

        var command = new ConfirmPropertyPhotoUploadCommand(
            property.Id,
            storageKey,
            $"{_testAccountId}/properties/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo-2.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();

        _dbContextMock.Verify(x => x.PropertyPhotos.Add(It.Is<PropertyPhoto>(
            p => p.IsPrimary == false && p.DisplayOrder == 1
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_MultipleExistingPhotos_SetsCorrectDisplayOrder()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var existingPhotos = new List<PropertyPhoto>
        {
            CreatePropertyPhoto(_testAccountId, property.Id, isPrimary: true, displayOrder: 0),
            CreatePropertyPhoto(_testAccountId, property.Id, isPrimary: false, displayOrder: 1),
            CreatePropertyPhoto(_testAccountId, property.Id, isPrimary: false, displayOrder: 2)
        };
        var storageKey = $"{_testAccountId}/properties/2026/test-photo.jpg";

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(existingPhotos);
        SetupPhotoServiceMock(storageKey);
        SetupPropertyPhotosAdd();

        var command = new ConfirmPropertyPhotoUploadCommand(
            property.Id,
            storageKey,
            $"{_testAccountId}/properties/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo-4.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.PropertyPhotos.Add(It.Is<PropertyPhoto>(
            p => p.DisplayOrder == 3
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/properties/2026/test-photo.jpg";
        SetupPropertiesDbSet(new List<Property>()); // No properties
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var command = new ConfirmPropertyPhotoUploadCommand(
            Guid.NewGuid(),
            storageKey,
            $"{_testAccountId}/properties/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_StorageKeyForDifferentAccount_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var otherAccountId = Guid.NewGuid();
        var storageKey = $"{otherAccountId}/properties/2026/test-photo.jpg"; // Different account

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var command = new ConfirmPropertyPhotoUploadCommand(
            property.Id,
            storageKey,
            $"{otherAccountId}/properties/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_InvalidStorageKeyFormat_ThrowsArgumentException()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var storageKey = "invalid-storage-key"; // No account ID prefix

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var command = new ConfirmPropertyPhotoUploadCommand(
            property.Id,
            storageKey,
            "invalid-thumbnail-key",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    private Property CreateProperty(Guid accountId)
    {
        return new Property
        {
            Id = _testPropertyId,
            AccountId = accountId,
            Name = "Test Property",
            Street = "123 Test Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
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

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private void SetupPropertyPhotosDbSet(List<PropertyPhoto> photos)
    {
        var mockDbSet = photos.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.PropertyPhotos).Returns(mockDbSet.Object);
    }

    private void SetupPropertyPhotosAdd()
    {
        _dbContextMock.Setup(x => x.PropertyPhotos.Add(It.IsAny<PropertyPhoto>()));
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
                $"{_testAccountId}/properties/2026/thumbnails/test.jpg",
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
