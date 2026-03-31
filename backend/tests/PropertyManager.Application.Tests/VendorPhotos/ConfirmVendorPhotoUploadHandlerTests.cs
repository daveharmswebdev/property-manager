using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for ConfirmVendorPhotoUploadHandler.
/// Tests auto-primary logic for first photo.
/// </summary>
public class ConfirmVendorPhotoUploadHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly ConfirmVendorPhotoUploadHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testVendorId = Guid.NewGuid();

    public ConfirmVendorPhotoUploadHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new ConfirmVendorPhotoUploadHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_FirstPhotoForVendor_SetsIsPrimaryTrue()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var storageKey = $"{_testAccountId}/vendors/2026/test-photo.jpg";

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto>());
        SetupPhotoServiceMock(storageKey);
        SetupVendorPhotosAdd();

        var command = new ConfirmVendorPhotoUploadCommand(
            vendor.Id,
            storageKey,
            $"{_testAccountId}/vendors/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        _dbContextMock.Verify(x => x.VendorPhotos.Add(It.Is<VendorPhoto>(
            p => p.IsPrimary == true && p.DisplayOrder == 0
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_SecondPhotoForVendor_SetsIsPrimaryFalse()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var existingPhoto = CreateVendorPhoto(_testAccountId, vendor.Id, isPrimary: true, displayOrder: 0);
        var storageKey = $"{_testAccountId}/vendors/2026/test-photo.jpg";

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto> { existingPhoto });
        SetupPhotoServiceMock(storageKey);
        SetupVendorPhotosAdd();

        var command = new ConfirmVendorPhotoUploadCommand(
            vendor.Id,
            storageKey,
            $"{_testAccountId}/vendors/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo-2.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        _dbContextMock.Verify(x => x.VendorPhotos.Add(It.Is<VendorPhoto>(
            p => p.IsPrimary == false && p.DisplayOrder == 1
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_MultipleExistingPhotos_SetsCorrectDisplayOrder()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var existingPhotos = new List<VendorPhoto>
        {
            CreateVendorPhoto(_testAccountId, vendor.Id, isPrimary: true, displayOrder: 0),
            CreateVendorPhoto(_testAccountId, vendor.Id, isPrimary: false, displayOrder: 1),
            CreateVendorPhoto(_testAccountId, vendor.Id, isPrimary: false, displayOrder: 2)
        };
        var storageKey = $"{_testAccountId}/vendors/2026/test-photo.jpg";

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(existingPhotos);
        SetupPhotoServiceMock(storageKey);
        SetupVendorPhotosAdd();

        var command = new ConfirmVendorPhotoUploadCommand(
            vendor.Id,
            storageKey,
            $"{_testAccountId}/vendors/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo-4.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.VendorPhotos.Add(It.Is<VendorPhoto>(
            p => p.DisplayOrder == 3
        )), Times.Once);
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/vendors/2026/test-photo.jpg";
        SetupVendorsDbSet(new List<Vendor>());
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var command = new ConfirmVendorPhotoUploadCommand(
            Guid.NewGuid(),
            storageKey,
            $"{_testAccountId}/vendors/2026/thumbnails/test-photo.jpg",
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
        var vendor = CreateVendor(_testAccountId);
        var otherAccountId = Guid.NewGuid();
        var storageKey = $"{otherAccountId}/vendors/2026/test-photo.jpg";

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var command = new ConfirmVendorPhotoUploadCommand(
            vendor.Id,
            storageKey,
            $"{otherAccountId}/vendors/2026/thumbnails/test-photo.jpg",
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
        var vendor = CreateVendor(_testAccountId);
        var storageKey = "invalid-storage-key";

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var command = new ConfirmVendorPhotoUploadCommand(
            vendor.Id,
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
    public async Task Handle_ValidRequest_CallsSaveChangesAsync()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var storageKey = $"{_testAccountId}/vendors/2026/test-photo.jpg";

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupVendorPhotosDbSet(new List<VendorPhoto>());
        SetupPhotoServiceMock(storageKey);
        SetupVendorPhotosAdd();

        var command = new ConfirmVendorPhotoUploadCommand(
            vendor.Id,
            storageKey,
            $"{_testAccountId}/vendors/2026/thumbnails/test-photo.jpg",
            "image/jpeg",
            1024,
            "test-photo.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
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

    private void SetupVendorPhotosAdd()
    {
        _dbContextMock.Setup(x => x.VendorPhotos.Add(It.IsAny<VendorPhoto>()));
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
                $"{_testAccountId}/vendors/2026/thumbnails/test.jpg",
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
