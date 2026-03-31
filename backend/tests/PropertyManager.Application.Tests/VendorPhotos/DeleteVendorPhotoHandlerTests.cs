using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for DeleteVendorPhotoHandler.
/// Tests primary promotion when primary photo is deleted.
/// </summary>
public class DeleteVendorPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly DeleteVendorPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testVendorId = Guid.NewGuid();
    private List<VendorPhoto> _photos = new();

    public DeleteVendorPhotoHandlerTests()
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

        _handler = new DeleteVendorPhotoHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_DeletePrimaryPhoto_PromotesNextPhotoByDisplayOrder()
    {
        // Arrange
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);
        var photo2 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: false, displayOrder: 1);
        var photo3 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: false, displayOrder: 2);

        _photos = new List<VendorPhoto> { photo1, photo2, photo3 };
        SetupVendorPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteVendorPhotoCommand(_testVendorId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo2.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_DeleteNonPrimaryPhoto_DoesNotPromoteOtherPhotos()
    {
        // Arrange
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);
        var photo2 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: false, displayOrder: 1);

        _photos = new List<VendorPhoto> { photo1, photo2 };
        SetupVendorPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteVendorPhotoCommand(_testVendorId, photo2.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo1.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_DeleteOnlyPhoto_NoPromotionNeeded()
    {
        // Arrange
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);

        _photos = new List<VendorPhoto> { photo1 };
        SetupVendorPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteVendorPhotoCommand(_testVendorId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        _photos = new List<VendorPhoto>();
        SetupVendorPhotosDbSet(_photos);

        var command = new DeleteVendorPhotoCommand(_testVendorId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var photo = CreateVendorPhoto(otherAccountId, _testVendorId, isPrimary: true, displayOrder: 0);

        _photos = new List<VendorPhoto> { photo };
        SetupVendorPhotosDbSet(_photos);

        var command = new DeleteVendorPhotoCommand(_testVendorId, photo.Id);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DeletesFromS3()
    {
        // Arrange
        var photo = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);

        _photos = new List<VendorPhoto> { photo };
        SetupVendorPhotosDbSet(_photos);
        SetupSaveChanges();

        var command = new DeleteVendorPhotoCommand(_testVendorId, photo.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
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

    private void SetupVendorPhotosDbSet(List<VendorPhoto> photos)
    {
        var mockDbSet = photos.BuildMockDbSet();

        mockDbSet.Setup(m => m.Remove(It.IsAny<VendorPhoto>()))
            .Callback<VendorPhoto>(p => _photos.Remove(p));

        _dbContextMock.Setup(x => x.VendorPhotos).Returns(mockDbSet.Object);
    }

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
