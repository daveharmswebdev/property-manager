using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for GenerateVendorPhotoUploadUrlHandler.
/// Tests presigned URL generation for vendor photo uploads.
/// </summary>
public class GenerateVendorPhotoUploadUrlHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GenerateVendorPhotoUploadUrlHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testVendorId = Guid.NewGuid();

    public GenerateVendorPhotoUploadUrlHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GenerateVendorPhotoUploadUrlHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsUploadUrlDetails()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        var expectedStorageKey = $"{_testAccountId}/vendors/2026/test.jpg";
        var expectedThumbnailKey = $"{_testAccountId}/vendors/2026/thumbnails/test.jpg";
        var expectedUploadUrl = "https://s3.amazonaws.com/bucket/presigned-url";
        var expectedExpiresAt = DateTime.UtcNow.AddMinutes(15);

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupPhotoServiceMock(expectedUploadUrl, expectedStorageKey, expectedThumbnailKey, expectedExpiresAt);

        var command = new GenerateVendorPhotoUploadUrlCommand(
            _testVendorId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().Be(expectedUploadUrl);
        result.StorageKey.Should().Be(expectedStorageKey);
        result.ThumbnailStorageKey.Should().Be(expectedThumbnailKey);
        result.ExpiresAt.Should().Be(expectedExpiresAt);
    }

    [Fact]
    public async Task Handle_ValidRequest_CallsPhotoServiceWithCorrectParameters()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupPhotoServiceMock();

        var command = new GenerateVendorPhotoUploadUrlCommand(
            _testVendorId,
            "image/png",
            2048,
            "screenshot.png");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.Is<PhotoUploadRequest>(r =>
                r.EntityType == PhotoEntityType.Vendors &&
                r.EntityId == _testVendorId &&
                r.ContentType == "image/png" &&
                r.FileSizeBytes == 2048 &&
                r.OriginalFileName == "screenshot.png"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupVendorsDbSet(new List<Vendor>());

        var command = new GenerateVendorPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_VendorBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var vendor = CreateVendor(otherAccountId);

        SetupVendorsDbSet(new List<Vendor> { vendor });

        var command = new GenerateVendorPhotoUploadUrlCommand(
            _testVendorId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_DeletedVendor_ThrowsNotFoundException()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        vendor.DeletedAt = DateTime.UtcNow;

        SetupVendorsDbSet(new List<Vendor> { vendor });

        var command = new GenerateVendorPhotoUploadUrlCommand(
            _testVendorId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_UsesCorrectEntityType()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId);
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupPhotoServiceMock();

        var command = new GenerateVendorPhotoUploadUrlCommand(
            _testVendorId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Verify PhotoEntityType.Vendors is used
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            It.IsAny<Guid>(),
            It.Is<PhotoUploadRequest>(r => r.EntityType == PhotoEntityType.Vendors),
            It.IsAny<CancellationToken>()), Times.Once);
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

    private void SetupVendorsDbSet(List<Vendor> vendors)
    {
        var mockDbSet = vendors.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }

    private void SetupPhotoServiceMock(
        string uploadUrl = "https://s3.amazonaws.com/bucket/presigned-url",
        string storageKey = "account/vendors/2026/test.jpg",
        string thumbnailKey = "account/vendors/2026/thumbnails/test.jpg",
        DateTime? expiresAt = null)
    {
        var expires = expiresAt ?? DateTime.UtcNow.AddMinutes(15);

        _photoServiceMock.Setup(x => x.GenerateUploadUrlAsync(
                It.IsAny<Guid>(),
                It.IsAny<PhotoUploadRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoUploadResult(
                uploadUrl,
                storageKey,
                thumbnailKey,
                expires));
    }
}
