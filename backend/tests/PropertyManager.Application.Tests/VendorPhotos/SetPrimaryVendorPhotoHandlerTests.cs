using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for SetPrimaryVendorPhotoHandler.
/// Tests primary photo switching logic.
/// </summary>
public class SetPrimaryVendorPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly SetPrimaryVendorPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testVendorId = Guid.NewGuid();

    public SetPrimaryVendorPhotoHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new SetPrimaryVendorPhotoHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_SetsNewPrimary_ClearsPrevious()
    {
        // Arrange
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);
        var photo2 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: false, displayOrder: 1);

        SetupVendorPhotosDbSet(new List<VendorPhoto> { photo1, photo2 });
        SetupSaveChanges();

        var command = new SetPrimaryVendorPhotoCommand(_testVendorId, photo2.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo1.IsPrimary.Should().BeFalse();
        photo2.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_AlreadyPrimary_NoOp()
    {
        // Arrange
        var photo1 = CreateVendorPhoto(_testAccountId, _testVendorId, isPrimary: true, displayOrder: 0);

        SetupVendorPhotosDbSet(new List<VendorPhoto> { photo1 });

        var command = new SetPrimaryVendorPhotoCommand(_testVendorId, photo1.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo1.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupVendorPhotosDbSet(new List<VendorPhoto>());

        var command = new SetPrimaryVendorPhotoCommand(_testVendorId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
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
        _dbContextMock.Setup(x => x.VendorPhotos).Returns(mockDbSet.Object);
    }

    private void SetupSaveChanges()
    {
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
