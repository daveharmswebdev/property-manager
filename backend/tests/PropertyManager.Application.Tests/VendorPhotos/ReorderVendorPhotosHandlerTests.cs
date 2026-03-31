using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for ReorderVendorPhotosHandler.
/// Tests photo reordering logic.
/// </summary>
public class ReorderVendorPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly ReorderVendorPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testVendorId = Guid.NewGuid();

    public ReorderVendorPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new ReorderVendorPhotosHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidReorder_UpdatesDisplayOrders()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, displayOrder: 0);
        var photo2 = CreateVendorPhoto(_testAccountId, _testVendorId, displayOrder: 1);
        var photo3 = CreateVendorPhoto(_testAccountId, _testVendorId, displayOrder: 2);

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto> { photo1, photo2, photo3 });
        SetupSaveChanges();

        // Reverse the order
        var command = new ReorderVendorPhotosCommand(_testVendorId, new List<Guid> { photo3.Id, photo2.Id, photo1.Id });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo3.DisplayOrder.Should().Be(0);
        photo2.DisplayOrder.Should().Be(1);
        photo1.DisplayOrder.Should().Be(2);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupVendorsDbSet(new List<Vendor>());
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var command = new ReorderVendorPhotosCommand(Guid.NewGuid(), new List<Guid> { Guid.NewGuid() });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoIdNotBelongingToVendor_ThrowsNotFoundException()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, displayOrder: 0);

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto> { photo1 });

        var command = new ReorderVendorPhotosCommand(_testVendorId, new List<Guid> { Guid.NewGuid() });

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_IncompletePhotoIds_ThrowsArgumentException()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, displayOrder: 0);
        var photo2 = CreateVendorPhoto(_testAccountId, _testVendorId, displayOrder: 1);

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto> { photo1, photo2 });

        // Only include one of two photos
        var command = new ReorderVendorPhotosCommand(_testVendorId, new List<Guid> { photo1.Id });

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
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

    private VendorPhoto CreateVendorPhoto(Guid accountId, Guid vendorId, int displayOrder)
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
            IsPrimary = displayOrder == 0,
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

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
