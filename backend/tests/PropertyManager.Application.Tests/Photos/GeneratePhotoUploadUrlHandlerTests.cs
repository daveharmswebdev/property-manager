using FluentAssertions;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Photos;

namespace PropertyManager.Application.Tests.Photos;

/// <summary>
/// Unit tests for GeneratePhotoUploadUrlHandler.
/// </summary>
public class GeneratePhotoUploadUrlHandlerTests
{
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GeneratePhotoUploadUrlHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GeneratePhotoUploadUrlHandlerTests()
    {
        _photoServiceMock = new Mock<IPhotoService>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        _handler = new GeneratePhotoUploadUrlHandler(
            _photoServiceMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_GeneratesPresignedUrl()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);
        var presignedUrl = "https://bucket.s3.amazonaws.com/presigned-url";
        var storageKey = $"{_testAccountId}/Properties/{DateTime.UtcNow.Year}/abc123.jpg";
        var thumbnailStorageKey = $"{_testAccountId}/Properties/{DateTime.UtcNow.Year}/abc123_thumb.jpg";

        _photoServiceMock
            .Setup(x => x.GenerateUploadUrlAsync(
                _testAccountId,
                It.IsAny<PhotoUploadRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoUploadResult(presignedUrl, storageKey, thumbnailStorageKey, expiresAt));

        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024 * 1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().Be(presignedUrl);
        result.StorageKey.Should().Be(storageKey);
        result.ThumbnailStorageKey.Should().Be(thumbnailStorageKey);
        result.ExpiresAt.Should().Be(expiresAt);
    }

    [Fact]
    public async Task Handle_CallsPhotoServiceWithCorrectAccountId()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);

        _photoServiceMock
            .Setup(x => x.GenerateUploadUrlAsync(
                It.IsAny<Guid>(),
                It.IsAny<PhotoUploadRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoUploadResult("https://example.com", "key", "thumb-key", expiresAt));

        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024 * 1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.IsAny<PhotoUploadRequest>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PassesCorrectRequestParameters()
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);
        var entityId = Guid.NewGuid();
        PhotoUploadRequest? capturedRequest = null;

        _photoServiceMock
            .Setup(x => x.GenerateUploadUrlAsync(
                It.IsAny<Guid>(),
                It.IsAny<PhotoUploadRequest>(),
                It.IsAny<CancellationToken>()))
            .Callback<Guid, PhotoUploadRequest, CancellationToken>((_, request, _) => capturedRequest = request)
            .ReturnsAsync(new PhotoUploadResult("https://example.com", "key", "thumb-key", expiresAt));

        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Vendors,
            entityId,
            "image/png",
            2048,
            "vendor-logo.png");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedRequest.Should().NotBeNull();
        capturedRequest!.EntityType.Should().Be(PhotoEntityType.Vendors);
        capturedRequest.EntityId.Should().Be(entityId);
        capturedRequest.ContentType.Should().Be("image/png");
        capturedRequest.FileSizeBytes.Should().Be(2048);
        capturedRequest.OriginalFileName.Should().Be("vendor-logo.png");
    }

    [Theory]
    [InlineData(PhotoEntityType.Properties)]
    [InlineData(PhotoEntityType.Vendors)]
    [InlineData(PhotoEntityType.Users)]
    [InlineData(PhotoEntityType.Receipts)]
    public async Task Handle_DifferentEntityTypes_CallsServiceCorrectly(PhotoEntityType entityType)
    {
        // Arrange
        var expiresAt = DateTime.UtcNow.AddMinutes(60);

        _photoServiceMock
            .Setup(x => x.GenerateUploadUrlAsync(
                It.IsAny<Guid>(),
                It.Is<PhotoUploadRequest>(r => r.EntityType == entityType),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoUploadResult("https://example.com", "key", "thumb-key", expiresAt));

        var command = new GeneratePhotoUploadUrlCommand(
            entityType,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            It.IsAny<Guid>(),
            It.Is<PhotoUploadRequest>(r => r.EntityType == entityType),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
