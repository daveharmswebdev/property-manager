using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Storage;

namespace PropertyManager.Infrastructure.Tests.Storage;

public class NoOpPhotoServiceTests
{
    private readonly NoOpPhotoService _sut;
    private readonly Mock<ILogger<NoOpPhotoService>> _loggerMock;

    public NoOpPhotoServiceTests()
    {
        _loggerMock = new Mock<ILogger<NoOpPhotoService>>();
        _sut = new NoOpPhotoService(_loggerMock.Object);
    }

    #region GenerateUploadUrlAsync Tests

    [Fact]
    public async Task GenerateUploadUrlAsync_ValidRequest_ReturnsNoOpResult()
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = await _sut.GenerateUploadUrlAsync(accountId, request);

        // Assert
        result.UploadUrl.Should().StartWith("https://noop-storage.local/");
        result.StorageKey.Should().Contain(accountId.ToString());
        result.StorageKey.Should().Contain("properties");
        result.StorageKey.Should().EndWith(".jpg");
        result.ThumbnailStorageKey.Should().Contain("_thumb.jpg");
        result.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddHours(1), TimeSpan.FromMinutes(1));
    }

    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/gif", ".gif")]
    [InlineData("image/webp", ".webp")]
    public async Task GenerateUploadUrlAsync_DifferentContentTypes_UsesCorrectExtension(
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
            "photo.xyz");

        // Act
        var result = await _sut.GenerateUploadUrlAsync(accountId, request);

        // Assert
        result.StorageKey.Should().EndWith(expectedExtension);
    }

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
    public async Task GenerateUploadUrlAsync_InvalidContentType_ThrowsArgumentException()
    {
        // Arrange
        var accountId = Guid.NewGuid();
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "application/pdf",
            1024,
            "document.pdf");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateUploadUrlAsync(accountId, request))
            .Should().ThrowAsync<ArgumentException>()
            .WithMessage("*not allowed*");
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
            PhotoValidation.MaxFileSizeBytes + 1,
            "huge.jpg");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.GenerateUploadUrlAsync(accountId, request))
            .Should().ThrowAsync<ArgumentException>()
            .WithMessage("*exceeds maximum*");
    }

    #endregion

    #region ConfirmUploadAsync Tests

    [Fact]
    public async Task ConfirmUploadAsync_ValidRequest_ReturnsPhotoRecord()
    {
        // Arrange
        var request = new ConfirmPhotoUploadRequest("key/photo.jpg", "key/photo_thumb.jpg");

        // Act
        var result = await _sut.ConfirmUploadAsync(request, "image/jpeg", 1024);

        // Assert
        result.StorageKey.Should().Be("key/photo.jpg");
        result.ThumbnailStorageKey.Should().Be("key/photo_thumb.jpg");
        result.ContentType.Should().Be("image/jpeg");
        result.FileSizeBytes.Should().Be(1024);
    }

    [Fact]
    public async Task ConfirmUploadAsync_NullRequest_ThrowsArgumentNullException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.ConfirmUploadAsync(null!, "image/jpeg", 1024))
            .Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task ConfirmUploadAsync_EmptyStorageKey_ThrowsArgumentException()
    {
        // Arrange
        var request = new ConfirmPhotoUploadRequest("", "thumb_key");

        // Act & Assert
        await FluentActions.Invoking(() => _sut.ConfirmUploadAsync(request, "image/jpeg", 1024))
            .Should().ThrowAsync<ArgumentException>();
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

    #region GetPhotoUrlAsync Tests

    [Fact]
    public async Task GetPhotoUrlAsync_ValidKey_ReturnsNoOpUrl()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo.jpg";

        // Act
        var result = await _sut.GetPhotoUrlAsync(storageKey);

        // Assert
        result.Should().Be($"https://noop-storage.local/{storageKey}");
    }

    [Fact]
    public async Task GetPhotoUrlAsync_EmptyKey_ThrowsArgumentException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.GetPhotoUrlAsync(""))
            .Should().ThrowAsync<ArgumentException>();
    }

    #endregion

    #region GetThumbnailUrlAsync Tests

    [Fact]
    public async Task GetThumbnailUrlAsync_ValidKey_ReturnsNoOpUrl()
    {
        // Arrange
        var thumbnailKey = "acc123/properties/2026/photo_thumb.jpg";

        // Act
        var result = await _sut.GetThumbnailUrlAsync(thumbnailKey);

        // Assert
        result.Should().Be($"https://noop-storage.local/{thumbnailKey}");
    }

    [Fact]
    public async Task GetThumbnailUrlAsync_EmptyKey_ThrowsArgumentException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.GetThumbnailUrlAsync(""))
            .Should().ThrowAsync<ArgumentException>();
    }

    #endregion

    #region DeletePhotoAsync Tests

    [Fact]
    public async Task DeletePhotoAsync_ValidKeys_CompletesSuccessfully()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo.jpg";
        var thumbnailKey = "acc123/properties/2026/photo_thumb.jpg";

        // Act & Assert
        await FluentActions.Invoking(() => _sut.DeletePhotoAsync(storageKey, thumbnailKey))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task DeletePhotoAsync_NullThumbnailKey_CompletesSuccessfully()
    {
        // Arrange
        var storageKey = "acc123/properties/2026/photo.jpg";

        // Act & Assert
        await FluentActions.Invoking(() => _sut.DeletePhotoAsync(storageKey, null))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task DeletePhotoAsync_EmptyStorageKey_ThrowsArgumentException()
    {
        // Act & Assert
        await FluentActions.Invoking(() => _sut.DeletePhotoAsync("", null))
            .Should().ThrowAsync<ArgumentException>();
    }

    #endregion
}
