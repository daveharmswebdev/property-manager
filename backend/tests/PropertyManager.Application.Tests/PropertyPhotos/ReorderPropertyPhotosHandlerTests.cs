using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.PropertyPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for ReorderPropertyPhotosHandler (AC-13.3a.7).
/// Tests reordering photos and updating DisplayOrder values.
/// </summary>
public class ReorderPropertyPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly ReorderPropertyPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public ReorderPropertyPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new ReorderPropertyPhotosHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ReorderPhotos_UpdatesDisplayOrder()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 1);
        var photo3 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 2);

        var property = CreateProperty(_testAccountId);
        var photos = new List<PropertyPhoto> { photo1, photo2, photo3 };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(photos);
        SetupSaveChanges();

        // Reorder: photo3 -> photo1 -> photo2
        var command = new ReorderPropertyPhotosCommand(
            _testPropertyId,
            new List<Guid> { photo3.Id, photo1.Id, photo2.Id });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo3.DisplayOrder.Should().Be(0);
        photo1.DisplayOrder.Should().Be(1);
        photo2.DisplayOrder.Should().Be(2);
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupPropertiesDbSet(new List<Property>()); // No properties
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var command = new ReorderPropertyPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid() });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoNotInProperty_ThrowsNotFoundException()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 0);
        var property = CreateProperty(_testAccountId);

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { photo1 });

        var command = new ReorderPropertyPhotosCommand(
            _testPropertyId,
            new List<Guid> { photo1.Id, Guid.NewGuid() }); // Non-existent photo

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_IncompletePhotoList_ThrowsArgumentException()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 1);
        var property = CreateProperty(_testAccountId);

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { photo1, photo2 });

        // Missing photo2
        var command = new ReorderPropertyPhotosCommand(
            _testPropertyId,
            new List<Guid> { photo1.Id });

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DuplicatePhotoIds_ThrowsArgumentException()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 1);
        var property = CreateProperty(_testAccountId);

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { photo1, photo2 });

        // Duplicate photo1.Id instead of photo2
        var command = new ReorderPropertyPhotosCommand(
            _testPropertyId,
            new List<Guid> { photo1.Id, photo1.Id });

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PropertyBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var property = new Property
        {
            Id = _testPropertyId,
            AccountId = otherAccountId, // Different account
            Name = "Other Property",
            Street = "123 Test",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var command = new ReorderPropertyPhotosCommand(
            _testPropertyId,
            new List<Guid> { Guid.NewGuid() });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ReverseOrder_UpdatesCorrectly()
    {
        // Arrange
        var photo1 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 0);
        var photo2 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 1);
        var photo3 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 2);
        var photo4 = CreatePropertyPhoto(_testAccountId, _testPropertyId, displayOrder: 3);

        var property = CreateProperty(_testAccountId);
        var photos = new List<PropertyPhoto> { photo1, photo2, photo3, photo4 };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(photos);
        SetupSaveChanges();

        // Reverse order
        var command = new ReorderPropertyPhotosCommand(
            _testPropertyId,
            new List<Guid> { photo4.Id, photo3.Id, photo2.Id, photo1.Id });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo4.DisplayOrder.Should().Be(0);
        photo3.DisplayOrder.Should().Be(1);
        photo2.DisplayOrder.Should().Be(2);
        photo1.DisplayOrder.Should().Be(3);
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

    private PropertyPhoto CreatePropertyPhoto(Guid accountId, Guid propertyId, int displayOrder)
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
            IsPrimary = displayOrder == 0,
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

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
