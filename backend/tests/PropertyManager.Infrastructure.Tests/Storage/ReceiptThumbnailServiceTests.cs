using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Storage;
using System.Net;

namespace PropertyManager.Infrastructure.Tests.Storage;

public class ReceiptThumbnailServiceTests
{
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly Mock<IThumbnailService> _thumbnailServiceMock;
    private readonly Mock<IPdfRendererService> _pdfRendererServiceMock;
    private readonly Mock<ILogger<ReceiptThumbnailService>> _loggerMock;
    private readonly Mock<HttpMessageHandler> _httpMessageHandlerMock;
    private readonly HttpClient _httpClient;
    private readonly ReceiptThumbnailService _sut;

    private readonly byte[] _fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }; // JPEG header
    private readonly byte[] _fakeThumbnailBytes = new byte[] { 0x01, 0x02, 0x03 };
    private readonly byte[] _fakePdfPageImage = new byte[] { 0x89, 0x50, 0x4E, 0x47 }; // PNG header

    public ReceiptThumbnailServiceTests()
    {
        _storageServiceMock = new Mock<IStorageService>();
        _thumbnailServiceMock = new Mock<IThumbnailService>();
        _pdfRendererServiceMock = new Mock<IPdfRendererService>();
        _loggerMock = new Mock<ILogger<ReceiptThumbnailService>>();
        _httpMessageHandlerMock = new Mock<HttpMessageHandler>();
        _httpClient = new HttpClient(_httpMessageHandlerMock.Object);

        _sut = new ReceiptThumbnailService(
            _storageServiceMock.Object,
            _thumbnailServiceMock.Object,
            _pdfRendererServiceMock.Object,
            _httpClient,
            _loggerMock.Object);

        // Default: storage service returns presigned URLs
        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://s3.test/download");

        _storageServiceMock
            .Setup(x => x.GeneratePresignedUploadUrlAsync(
                It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<long>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UploadUrlResult("https://s3.test/upload", DateTime.UtcNow.AddMinutes(15)));

        // Default: thumbnail service returns fake thumbnail bytes
        _thumbnailServiceMock
            .Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<Stream>(), It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(_fakeThumbnailBytes);

        // Default: PDF renderer returns fake image
        _pdfRendererServiceMock
            .Setup(x => x.RenderFirstPageToImageAsync(
                It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(_fakePdfPageImage);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_ImageReceipt_DownloadsAndGeneratesThumbnail()
    {
        // Arrange
        SetupHttpDownload(_fakeImageBytes);
        SetupHttpUpload();

        // Act
        var result = await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.jpg", "image/jpeg");

        // Assert
        result.Should().Be("account/2025/receipt_thumb.jpg");

        _storageServiceMock.Verify(x => x.GeneratePresignedDownloadUrlAsync(
            "account/2025/receipt.jpg", It.IsAny<CancellationToken>()), Times.Once);

        _thumbnailServiceMock.Verify(x => x.GenerateThumbnailAsync(
            It.IsAny<Stream>(), 300, 300, It.IsAny<CancellationToken>()), Times.Once);

        // Should NOT call PDF renderer for images
        _pdfRendererServiceMock.Verify(x => x.RenderFirstPageToImageAsync(
            It.IsAny<Stream>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_PdfReceipt_RendersThenGeneratesThumbnail()
    {
        // Arrange
        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // %PDF
        SetupHttpDownload(pdfBytes);
        SetupHttpUpload();

        // Act
        var result = await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.pdf", "application/pdf");

        // Assert
        result.Should().Be("account/2025/receipt_thumb.jpg");

        _pdfRendererServiceMock.Verify(x => x.RenderFirstPageToImageAsync(
            It.IsAny<Stream>(), It.IsAny<CancellationToken>()), Times.Once);

        _thumbnailServiceMock.Verify(x => x.GenerateThumbnailAsync(
            It.IsAny<Stream>(), 300, 300, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_UploadsThumbnailToS3()
    {
        // Arrange
        SetupHttpDownload(_fakeImageBytes);
        SetupHttpUpload();

        // Act
        await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.jpg", "image/jpeg");

        // Assert
        _storageServiceMock.Verify(x => x.GeneratePresignedUploadUrlAsync(
            "account/2025/receipt_thumb.jpg",
            "image/jpeg",
            _fakeThumbnailBytes.Length,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateThumbnailAsync_DownloadFails_ReturnsNull()
    {
        // Arrange
        SetupHttpDownloadFailure();

        // Act
        var result = await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.jpg", "image/jpeg");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GenerateThumbnailAsync_ThumbnailServiceFails_ReturnsNull()
    {
        // Arrange
        SetupHttpDownload(_fakeImageBytes);

        _thumbnailServiceMock
            .Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<Stream>(), It.IsAny<int>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Corrupt image"));

        // Act
        var result = await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.jpg", "image/jpeg");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GenerateThumbnailAsync_PdfRendererFails_ReturnsNull()
    {
        // Arrange
        SetupHttpDownload(new byte[] { 0x25, 0x50, 0x44, 0x46 });

        _pdfRendererServiceMock
            .Setup(x => x.RenderFirstPageToImageAsync(
                It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Corrupt PDF"));

        // Act
        var result = await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.pdf", "application/pdf");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GenerateThumbnailAsync_UploadFails_ReturnsNull()
    {
        // Arrange
        SetupHttpDownload(_fakeImageBytes);
        SetupHttpUploadFailure();

        // Act
        var result = await _sut.GenerateThumbnailAsync(
            "account/2025/receipt.jpg", "image/jpeg");

        // Assert
        result.Should().BeNull();
    }

    [Theory]
    [InlineData("account/2025/file.jpg", "account/2025/file_thumb.jpg")]
    [InlineData("account/2025/file.pdf", "account/2025/file_thumb.jpg")]
    [InlineData("account/2025/file.png", "account/2025/file_thumb.jpg")]
    [InlineData("a/b/c.test.jpg", "a/b/c.test_thumb.jpg")]
    public void DeriveThumbKey_GeneratesCorrectKey(string storageKey, string expected)
    {
        ReceiptThumbnailService.DeriveThumbKey(storageKey).Should().Be(expected);
    }

    private void SetupHttpDownload(byte[] responseBytes)
    {
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(m => m.Method == HttpMethod.Get),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(responseBytes)
            });
    }

    private void SetupHttpDownloadFailure()
    {
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(m => m.Method == HttpMethod.Get),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.InternalServerError));
    }

    private void SetupHttpUpload()
    {
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(m => m.Method == HttpMethod.Put),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK));
    }

    private void SetupHttpUploadFailure()
    {
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(m => m.Method == HttpMethod.Put),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.InternalServerError));
    }
}
