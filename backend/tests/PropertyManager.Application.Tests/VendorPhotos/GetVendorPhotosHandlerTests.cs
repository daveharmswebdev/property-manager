using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for GetVendorPhotosHandler.
/// Tests photo retrieval with presigned URLs.
/// </summary>
public class GetVendorPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GetVendorPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testVendorId = Guid.NewGuid();

    public GetVendorPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/photo.jpg");
        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/thumbnail.jpg");

        _handler = new GetVendorPhotosHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_VendorWithPhotos_ReturnsPhotosOrderedByDisplayOrder()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var photos = new List<VendorPhoto>
        {
            CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: false, displayOrder: 2),
            CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0),
            CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: false, displayOrder: 1)
        };

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(photos);

        var query = new GetVendorPhotosQuery(_testVendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].DisplayOrder.Should().Be(0);
        result.Items[1].DisplayOrder.Should().Be(1);
        result.Items[2].DisplayOrder.Should().Be(2);
    }

    [Fact]
    public async Task Handle_VendorWithNoPhotos_ReturnsEmptyList()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var query = new GetVendorPhotosQuery(_testVendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupVendorsDbSet(new List<Vendor>());
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var query = new GetVendorPhotosQuery(Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ReturnsPresignedUrls()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var photo = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto> { photo });

        var query = new GetVendorPhotosQuery(_testVendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].ViewUrl.Should().Be("https://example.com/photo.jpg");
        result.Items[0].ThumbnailUrl.Should().Be("https://example.com/thumbnail.jpg");
    }

    private Vendor CreateVendor(Guid accountId)
    {
        return new Vendor
        {
            Id = _testVendorId,
            AccountId = accountId,
            FirstName = "Test",
            LastName = "Vendor",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private VendorPhoto CreateVendorPhoto(Guid accountId, Guid vendorId, bool isPrimary, int displayOrder)
    {
        return new VendorPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            VendorId = vendorId,
            StorageKey = $"{accountId}/vendors/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/vendors/2026/thumbnails/{Guid.NewGuid()}.jpg",
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

    private void SetupVendorsDbSet(List<Vendor> vendors)
    {
        var mockDbSet = vendors.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }

    private void SetupVendorPhotosDbSet(List<VendorPhoto> photos)
    {
        var mockDbSet = photos.BuildMockDbSet();
        _dbContextMock.Setup(x => x.VendorPhotos).Returns(mockDbSet.Object);
    }
}
