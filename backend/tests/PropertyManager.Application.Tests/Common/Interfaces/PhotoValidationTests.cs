using FluentAssertions;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Common.Interfaces;

public class PhotoValidationTests
{
    #region ValidateRequest Tests

    [Fact]
    public void ValidateRequest_ValidRequest_DoesNotThrow()
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().NotThrow();
    }

    [Fact]
    public void ValidateRequest_NullRequest_ThrowsArgumentNullException()
    {
        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(null!))
            .Should().Throw<ArgumentNullException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public void ValidateRequest_ZeroOrNegativeFileSize_ThrowsArgumentException(long fileSize)
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            fileSize,
            "test.jpg");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().Throw<ArgumentException>()
            .WithMessage("*greater than zero*");
    }

    [Fact]
    public void ValidateRequest_FileSizeExceedsLimit_ThrowsArgumentException()
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            PhotoValidation.MaxFileSizeBytes + 1,
            "huge.jpg");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().Throw<ArgumentException>()
            .WithMessage("*exceeds maximum*10 MB*");
    }

    [Fact]
    public void ValidateRequest_FileSizeAtLimit_DoesNotThrow()
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            PhotoValidation.MaxFileSizeBytes, // Exactly at limit
            "large.jpg");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().NotThrow();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateRequest_EmptyContentType_ThrowsArgumentException(string? contentType)
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            contentType!,
            1024,
            "test.jpg");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().Throw<ArgumentException>()
            .WithMessage("*Content type*required*");
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("text/plain")]
    [InlineData("video/mp4")]
    [InlineData("application/octet-stream")]
    public void ValidateRequest_InvalidContentType_ThrowsArgumentException(string contentType)
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            contentType,
            1024,
            "file.xyz");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().Throw<ArgumentException>()
            .WithMessage($"*'{contentType}'*not allowed*");
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/gif")]
    [InlineData("image/webp")]
    [InlineData("image/bmp")]
    [InlineData("image/tiff")]
    [InlineData("IMAGE/JPEG")] // Case insensitive
    [InlineData("Image/Png")]
    public void ValidateRequest_ValidContentTypes_DoesNotThrow(string contentType)
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            contentType,
            1024,
            "image.jpg");

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().NotThrow();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateRequest_EmptyOriginalFileName_ThrowsArgumentException(string? fileName)
    {
        // Arrange
        var request = new PhotoUploadRequest(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            fileName!);

        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.ValidateRequest(request))
            .Should().Throw<ArgumentException>()
            .WithMessage("*file name*required*");
    }

    #endregion

    #region GetExtensionFromContentType Tests

    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/gif", ".gif")]
    [InlineData("image/webp", ".webp")]
    [InlineData("image/bmp", ".bmp")]
    [InlineData("image/tiff", ".tiff")]
    [InlineData("IMAGE/JPEG", ".jpg")] // Case insensitive
    [InlineData("Image/PNG", ".png")]
    public void GetExtensionFromContentType_ValidContentType_ReturnsCorrectExtension(
        string contentType,
        string expectedExtension)
    {
        // Act
        var result = PhotoValidation.GetExtensionFromContentType(contentType);

        // Assert
        result.Should().Be(expectedExtension);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void GetExtensionFromContentType_EmptyContentType_ThrowsArgumentException(string? contentType)
    {
        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.GetExtensionFromContentType(contentType!))
            .Should().Throw<ArgumentException>()
            .WithMessage("*Content type*required*");
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("text/plain")]
    [InlineData("video/mp4")]
    [InlineData("image/svg+xml")]
    public void GetExtensionFromContentType_UnsupportedContentType_ThrowsArgumentException(string contentType)
    {
        // Act & Assert
        FluentActions.Invoking(() => PhotoValidation.GetExtensionFromContentType(contentType))
            .Should().Throw<ArgumentException>()
            .WithMessage($"*Unsupported content type*{contentType}*");
    }

    #endregion

    #region Constants Tests

    [Fact]
    public void MaxFileSizeBytes_Is10MB()
    {
        // Assert
        PhotoValidation.MaxFileSizeBytes.Should().Be(10 * 1024 * 1024);
    }

    [Fact]
    public void AllowedContentTypes_ContainsExpectedTypes()
    {
        // Assert
        PhotoValidation.AllowedContentTypes.Should().BeEquivalentTo(new[]
        {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/bmp",
            "image/tiff"
        });
    }

    #endregion
}
