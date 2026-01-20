using FluentAssertions;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Photos;

namespace PropertyManager.Application.Tests.Photos;

/// <summary>
/// Unit tests for ConfirmPhotoUploadHandler.
/// </summary>
public class ConfirmPhotoUploadHandlerTests
{
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly ConfirmPhotoUploadHandler _handler;

    public ConfirmPhotoUploadHandlerTests()
    {
        _photoServiceMock = new Mock<IPhotoService>();
        _handler = new ConfirmPhotoUploadHandler(_photoServiceMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsConfirmedPhotoDetails()
    {
        // Arrange
        var storageKey = "account123/Properties/2026/abc.jpg";
        var thumbnailStorageKey = "account123/Properties/2026/abc_thumb.jpg";
        var contentType = "image/jpeg";
        var fileSizeBytes = 1024L;

        _photoServiceMock
            .Setup(x => x.ConfirmUploadAsync(
                It.IsAny<ConfirmPhotoUploadRequest>(),
                contentType,
                fileSizeBytes,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoRecord(storageKey, thumbnailStorageKey, contentType, fileSizeBytes));

        var command = new ConfirmPhotoUploadCommand(
            storageKey,
            thumbnailStorageKey,
            contentType,
            fileSizeBytes);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.StorageKey.Should().Be(storageKey);
        result.ThumbnailStorageKey.Should().Be(thumbnailStorageKey);
        result.ContentType.Should().Be(contentType);
        result.FileSizeBytes.Should().Be(fileSizeBytes);
    }

    [Fact]
    public async Task Handle_ThumbnailGenerationFails_ReturnsNullThumbnailStorageKey()
    {
        // Arrange
        var storageKey = "account123/Properties/2026/abc.jpg";
        var thumbnailStorageKey = "account123/Properties/2026/abc_thumb.jpg";
        var contentType = "image/jpeg";
        var fileSizeBytes = 1024L;

        _photoServiceMock
            .Setup(x => x.ConfirmUploadAsync(
                It.IsAny<ConfirmPhotoUploadRequest>(),
                contentType,
                fileSizeBytes,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoRecord(storageKey, null, contentType, fileSizeBytes));

        var command = new ConfirmPhotoUploadCommand(
            storageKey,
            thumbnailStorageKey,
            contentType,
            fileSizeBytes);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.StorageKey.Should().Be(storageKey);
        result.ThumbnailStorageKey.Should().BeNull();
    }

    [Fact]
    public async Task Handle_CallsPhotoServiceWithCorrectParameters()
    {
        // Arrange
        var storageKey = "account123/Vendors/2026/xyz.png";
        var thumbnailStorageKey = "account123/Vendors/2026/xyz_thumb.jpg";
        var contentType = "image/png";
        var fileSizeBytes = 2048L;
        ConfirmPhotoUploadRequest? capturedRequest = null;

        _photoServiceMock
            .Setup(x => x.ConfirmUploadAsync(
                It.IsAny<ConfirmPhotoUploadRequest>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .Callback<ConfirmPhotoUploadRequest, string, long, CancellationToken>((req, _, _, _) => capturedRequest = req)
            .ReturnsAsync(new PhotoRecord(storageKey, thumbnailStorageKey, contentType, fileSizeBytes));

        var command = new ConfirmPhotoUploadCommand(
            storageKey,
            thumbnailStorageKey,
            contentType,
            fileSizeBytes);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedRequest.Should().NotBeNull();
        capturedRequest!.StorageKey.Should().Be(storageKey);
        capturedRequest.ThumbnailStorageKey.Should().Be(thumbnailStorageKey);

        _photoServiceMock.Verify(x => x.ConfirmUploadAsync(
            It.IsAny<ConfirmPhotoUploadRequest>(),
            contentType,
            fileSizeBytes,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/gif")]
    [InlineData("image/webp")]
    public async Task Handle_DifferentContentTypes_ProcessesCorrectly(string contentType)
    {
        // Arrange
        var storageKey = "account123/Properties/2026/test.jpg";
        var thumbnailStorageKey = "account123/Properties/2026/test_thumb.jpg";

        _photoServiceMock
            .Setup(x => x.ConfirmUploadAsync(
                It.IsAny<ConfirmPhotoUploadRequest>(),
                contentType,
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoRecord(storageKey, thumbnailStorageKey, contentType, 1024));

        var command = new ConfirmPhotoUploadCommand(
            storageKey,
            thumbnailStorageKey,
            contentType,
            1024);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.ContentType.Should().Be(contentType);
    }
}
