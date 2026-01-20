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
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly ConfirmPhotoUploadHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public ConfirmPhotoUploadHandlerTests()
    {
        _photoServiceMock = new Mock<IPhotoService>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new ConfirmPhotoUploadHandler(_photoServiceMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsConfirmedPhotoDetails()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/Properties/2026/abc.jpg";
        var thumbnailStorageKey = $"{_testAccountId}/Properties/2026/abc_thumb.jpg";
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
        var storageKey = $"{_testAccountId}/Properties/2026/abc.jpg";
        var thumbnailStorageKey = $"{_testAccountId}/Properties/2026/abc_thumb.jpg";
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
        var storageKey = $"{_testAccountId}/Vendors/2026/xyz.png";
        var thumbnailStorageKey = $"{_testAccountId}/Vendors/2026/xyz_thumb.jpg";
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
        var storageKey = $"{_testAccountId}/Properties/2026/test.jpg";
        var thumbnailStorageKey = $"{_testAccountId}/Properties/2026/test_thumb.jpg";

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

    [Fact]
    public async Task Handle_DifferentAccountId_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var differentAccountId = Guid.NewGuid();
        var storageKey = $"{differentAccountId}/Properties/2026/test.jpg";
        var thumbnailStorageKey = $"{differentAccountId}/Properties/2026/test_thumb.jpg";

        var command = new ConfirmPhotoUploadCommand(
            storageKey,
            thumbnailStorageKey,
            "image/jpeg",
            1024);

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_InvalidStorageKeyFormat_ThrowsArgumentException()
    {
        // Arrange - storage key without valid GUID prefix
        var command = new ConfirmPhotoUploadCommand(
            "invalid-key/Properties/2026/test.jpg",
            "invalid-key/Properties/2026/test_thumb.jpg",
            "image/jpeg",
            1024);

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }
}
