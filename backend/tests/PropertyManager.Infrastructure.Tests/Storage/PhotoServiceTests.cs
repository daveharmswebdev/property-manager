using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Storage;
using System.Net;

namespace PropertyManager.Infrastructure.Tests.Storage;

public class PhotoServiceTests
{
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly Mock<IThumbnailService> _thumbnailServiceMock;
    private readonly Mock<ILogger<PhotoService>> _loggerMock;
    private readonly Mock<HttpMessageHandler> _httpMessageHandlerMock;
    private readonly HttpClient _httpClient;
    private readonly PhotoService _sut;

    public PhotoServiceTests()
    {
        _storageServiceMock = new Mock<IStorageService>();
        _thumbnailServiceMock = new Mock<IThumbnailService>();
        _loggerMock = new Mock<ILogger<PhotoService>>();
        _httpMessageHandlerMock = new Mock<HttpMessageHandler>();
        _httpClient = new HttpClient(_httpMessageHandlerMock.Object);

        _sut = new PhotoService(
            _storageServiceMock.Object,
            _thumbnailServiceMock.Object,
            _httpClient,
            _loggerMock.Object);
    }

    [Fact]
    public async Task GenerateUploadUrlAsync_GeneratesCorrectStorageKeyPattern()
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        var expectedUploadUrl = "https://s3.amazonaws.com/test-upload-url";
        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                request.ContentType,
                request.FileSizeBytes,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult(expectedUploadUrl, expiresAt));

        // Act
        var result = await _sut.GenerateUploadUrlAsync(accountId, request);

        // Assert
        result.UploadUrl.Should().Be(expectedUploadUrl);
        result.StorageKey.Should().Contain(accountId.ToString());
        result.StorageKey.Should().Contain("properties"); // entityType
        result.StorageKey.Should().Contain(DateTime.UtcNow.Year.ToString()); // year
        result.StorageKey.Should().EndWith(".jpg");
        result.ThumbnailStorageKey.Should().Contain("_thumb");
        result.ExpiresAt.Should().Be(expiresAt);
    }

    [Theory]
    [InlineData(PhotoEntityType.Receipts, "receipts")]
    [InlineData(PhotoEntityType.Properties, "properties")]
    [InlineData(PhotoEntityType.Vendors, "vendors")]
    [InlineData(PhotoEntityType.Users, "users")]
    public async Task GenerateUploadUrlAsync_UsesCorrectEntityTypeInPath(
        PhotoEntityType entityType,
        string expectedPath)
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            entityType,
            Guid.NewGuid(),
            "image/png",
            2048,
            "photo.png");

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.Is<string>(key => key.Contains(expectedPath)),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://test.com/upload", DateTime.UtcNow.AddMinutes(15)));

        // Act
        var result = await _sut.GenerateUploadUrlAsync(accountId, request);

        // Assert
        result.StorageKey.Should().Contain(expectedPath);
        _storageServiceMock.Verify(x => x.GeneratePresignedUploadUrlAsync(
            It.Is<string>(key => key.Contains(expectedPath)),
            It.IsAny<string>(),
            It.IsAny<long>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ConfirmUploadAsync_DownloadsOriginalAndGeneratesThumbnail()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo123.jpg";
        var thumbnailStorageKey = "acc123/properties/2026/photo123_thumb.jpg";
        var request = new ConfirmPhotoUploadRequest(storageKey, thumbnailStorageKey);

        var downloadUrl = "https://s3.amazonaws.com/original-photo";
        var thumbnailBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }; // JPEG magic bytes

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(storageKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(downloadUrl);

        SetupHttpResponse(downloadUrl, new byte[] { 0x01, 0x02, 0x03 });

        _thumbnailServiceMock
            .Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<Stream>(),
                300, 300,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(thumbnailBytes);

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                thumbnailStorageKey,
                "image/jpeg",
                thumbnailBytes.Length,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://s3.amazonaws.com/upload-thumb", DateTime.UtcNow.AddMinutes(15)));

        SetupHttpPutResponse("https://s3.amazonaws.com/upload-thumb");

        // Act
        var result = await _sut.ConfirmUploadAsync(request, "image/jpeg", 1024);

        // Assert
        result.StorageKey.Should().Be(storageKey);
        result.ThumbnailStorageKey.Should().Be(thumbnailStorageKey);
        result.ContentType.Should().Be("image/jpeg");
        result.FileSizeBytes.Should().Be(1024);

        _thumbnailServiceMock.Verify(x => x.GenerateThumbnailAsync(
            It.IsAny<Stream>(),
            300, 300,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ConfirmUploadAsync_ThumbnailFailure_ReturnsPhotoRecordWithNullThumbnail()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo123.jpg";
        var thumbnailStorageKey = "acc123/properties/2026/photo123_thumb.jpg";
        var request = new ConfirmPhotoUploadRequest(storageKey, thumbnailStorageKey);

        var downloadUrl = "https://s3.amazonaws.com/original-photo";

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(storageKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(downloadUrl);

        SetupHttpResponse(downloadUrl, new byte[] { 0x01, 0x02, 0x03 });

        _thumbnailServiceMock
            .Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<Stream>(),
                It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Cannot process image"));

        // Act
        var result = await _sut.ConfirmUploadAsync(request, "image/jpeg", 1024);

        // Assert - Should not throw, but return record with null thumbnail
        result.StorageKey.Should().Be(storageKey);
        result.ThumbnailStorageKey.Should().BeNull();
        result.ContentType.Should().Be("image/jpeg");
    }

    [Fact]
    public async Task GetPhotoUrlAsync_ReturnsPresignedUrl()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo123.jpg";
        var expectedUrl = "https://s3.amazonaws.com/download-url";

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(storageKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedUrl);

        // Act
        var result = await _sut.GetPhotoUrlAsync(storageKey);

        // Assert
        result.Should().Be(expectedUrl);
    }

    [Fact]
    public async Task GetThumbnailUrlAsync_ReturnsPresignedUrl()
    {
        // Arrange
        var thumbnailKey = "acc123/properties/2026/photo123_thumb.jpg";
        var expectedUrl = "https://s3.amazonaws.com/thumbnail-url";

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(thumbnailKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedUrl);

        // Act
        var result = await _sut.GetThumbnailUrlAsync(thumbnailKey);

        // Assert
        result.Should().Be(expectedUrl);
    }

    [Fact]
    public async Task DeletePhotoAsync_DeletesBothOriginalAndThumbnail()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo123.jpg";
        var thumbnailKey = "acc123/properties/2026/photo123_thumb.jpg";

        _storageServiceMock
            .Setup(x => x.DeleteFileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _sut.DeletePhotoAsync(storageKey, thumbnailKey);

        // Assert
        _storageServiceMock.Verify(x => x.DeleteFileAsync(storageKey, It.IsAny<CancellationToken>()), Times.Once);
        _storageServiceMock.Verify(x => x.DeleteFileAsync(thumbnailKey, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeletePhotoAsync_NullThumbnailKey_DeletesOnlyOriginal()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo123.jpg";

        _storageServiceMock
            .Setup(x => x.DeleteFileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _sut.DeletePhotoAsync(storageKey, null);

        // Assert
        _storageServiceMock.Verify(x => x.DeleteFileAsync(storageKey, It.IsAny<CancellationToken>()), Times.Once);
        _storageServiceMock.Verify(x => x.DeleteFileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/gif", ".gif")]
    [InlineData("image/webp", ".webp")]
    public async Task GenerateUploadUrlAsync_UsesCorrectExtensionForContentType(
        string contentType,
        string expectedExtension)
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            contentType,
            1024,
            "original.whatever");

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<long>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://test.com/upload", DateTime.UtcNow.AddMinutes(15)));

        // Act
        var result = await _sut.GenerateUploadUrlAsync(accountId, request);

        // Assert
        result.StorageKey.Should().EndWith(expectedExtension);
    }

    #region Input Validation Tests

    [Fact]
    public async Task GenerateUploadUrlAsync_EmptyAccountId_ThrowsArgumentException()
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateUploadUrlAsync(Guid.Empty, request))
            .Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Account ID*");
    }

    [Fact]
    public async Task GenerateUploadUrlAsync_FileSizeExceedsLimit_ThrowsArgumentException()
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            PhotoValidation.MaxFileSizeBytes + 1, // Exceeds 10MB limit
            "huge.jpg");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateUploadUrlAsync(accountId, request))
            .Should().ThrowAsync<ArgumentException>()
            .WithMessage("*exceeds maximum*");
    }

    [Fact]
    public async Task GenerateUploadUrlAsync_InvalidContentType_ThrowsArgumentException()
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "application/pdf", // Invalid for photos
            1024,
            "document.pdf");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateUploadUrlAsync(accountId, request))
            .Should().ThrowAsync<ArgumentException>()
            .WithMessage("*not allowed*");
    }

    [Fact]
    public async Task GetPhotoUrlAsync_EmptyStorageKey_ThrowsArgumentException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.GetPhotoUrlAsync(""))
            .Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GetThumbnailUrlAsync_EmptyStorageKey_ThrowsArgumentException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.GetThumbnailUrlAsync(""))
            .Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task DeletePhotoAsync_EmptyStorageKey_ThrowsArgumentException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.DeletePhotoAsync("", null))
            .Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ConfirmUploadAsync_NullRequest_ThrowsArgumentNullException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.ConfirmUploadAsync(null!, "image/jpeg", 1024))
            .Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task ConfirmUploadAsync_ZeroFileSize_ThrowsArgumentException()
    {
        // Arrange
        var request = new ConfirmPhotoUploadRequest("key", "thumb_key");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.ConfirmUploadAsync(request, "image/jpeg", 0))
            .Should().ThrowAsync<ArgumentException>()
            .WithMessage("*greater than zero*");
    }

    #endregion

    private void SetupHttpResponse(string url, byte[] content)
    {
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == HttpMethod.Get &&
                    req.RequestUri!.ToString() == url),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new ByteArrayContent(content)
            });
    }

    private void SetupHttpPutResponse(string url)
    {
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == HttpMethod.Put &&
                    req.RequestUri!.ToString() == url),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK
            });
    }
}
