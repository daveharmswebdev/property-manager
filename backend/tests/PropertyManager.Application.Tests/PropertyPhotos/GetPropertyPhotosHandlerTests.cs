using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.PropertyPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for GetPropertyPhotosHandler (AC-13.3a.8).
/// Tests retrieval of photos ordered by DisplayOrder with presigned URLs.
/// </summary>
public class GetPropertyPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GetPropertyPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public GetPropertyPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetPropertyPhotosHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_PropertyWithPhotos_ReturnsPhotosOrderedByDisplayOrder()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var photos = new List<PropertyPhoto>
        {
            CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 2),
            CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0),
            CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1)
        };

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(photos);
        SetupPhotoServiceUrls();

        var query = new GetPropertyPhotosQuery(_testPropertyId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().HaveCount(3);
        result.Items[0].DisplayOrder.Should().Be(0);
        result.Items[1].DisplayOrder.Should().Be(1);
        result.Items[2].DisplayOrder.Should().Be(2);
    }

    [Fact]
    public async Task Handle_PropertyWithPhotos_ReturnsPresignedUrls()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var photo = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { photo });
        SetupPhotoServiceUrls();

        var query = new GetPropertyPhotosQuery(_testPropertyId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].ThumbnailUrl.Should().NotBeNullOrEmpty();
        result.Items[0].ViewUrl.Should().NotBeNullOrEmpty();

        _photoServiceMock.Verify(x => x.GetThumbnailUrlAsync(
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        _photoServiceMock.Verify(x => x.GetPhotoUrlAsync(
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PropertyWithNoPhotos_ReturnsEmptyList()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var query = new GetPropertyPhotosQuery(_testPropertyId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupPropertiesDbSet(new List<Property>());
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var query = new GetPropertyPhotosQuery(Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PropertyBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var property = CreateProperty(otherAccountId); // Different account

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto>());

        var query = new GetPropertyPhotosQuery(property.Id);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoWithoutThumbnail_ReturnsNullThumbnailUrl()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var photo = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        photo.ThumbnailStorageKey = null; // No thumbnail

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { photo });
        SetupPhotoServiceUrls();

        var query = new GetPropertyPhotosQuery(_testPropertyId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].ThumbnailUrl.Should().BeNull();
        result.Items[0].ViewUrl.Should().NotBeNullOrEmpty();

        _photoServiceMock.Verify(x => x.GetThumbnailUrlAsync(
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ReturnsCorrectPhotoMetadata()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var photo = CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0);
        photo.OriginalFileName = "vacation-house.jpg";
        photo.FileSizeBytes = 2048;

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPropertyPhotosDbSet(new List<PropertyPhoto> { photo });
        SetupPhotoServiceUrls();

        var query = new GetPropertyPhotosQuery(_testPropertyId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].OriginalFileName.Should().Be("vacation-house.jpg");
        result.Items[0].FileSizeBytes.Should().Be(2048);
        result.Items[0].IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_OnlyReturnsPhotosForRequestedProperty()
    {
        // Arrange
        var property1 = CreateProperty(_testAccountId);
        var property2Id = Guid.NewGuid();
        var property2 = new Property
        {
            Id = property2Id,
            AccountId = _testAccountId,
            Name = "Other Property",
            Street = "456 Other St",
            City = "Austin",
            State = "TX",
            ZipCode = "78702",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var photosProperty1 = new List<PropertyPhoto>
        {
            CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: true, displayOrder: 0),
            CreatePropertyPhoto(_testAccountId, _testPropertyId, isPrimary: false, displayOrder: 1)
        };

        var photosProperty2 = new List<PropertyPhoto>
        {
            CreatePropertyPhoto(_testAccountId, property2Id, isPrimary: true, displayOrder: 0)
        };

        SetupPropertiesDbSet(new List<Property> { property1, property2 });
        SetupPropertyPhotosDbSet(photosProperty1.Concat(photosProperty2).ToList());
        SetupPhotoServiceUrls();

        var query = new GetPropertyPhotosQuery(_testPropertyId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().AllSatisfy(p => p.DisplayOrder.Should().BeOneOf(0, 1));
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

    private void SetupPhotoServiceUrls()
    {
        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/thumbnail.jpg");

        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/photo.jpg");
    }
}
