using FluentValidation.TestHelper;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Photos;

namespace PropertyManager.Application.Tests.Photos;

/// <summary>
/// Unit tests for ConfirmPhotoUploadValidator.
/// </summary>
public class ConfirmPhotoUploadValidatorTests
{
    private readonly ConfirmPhotoUploadValidator _validator;

    public ConfirmPhotoUploadValidatorTests()
    {
        _validator = new ConfirmPhotoUploadValidator();
    }

    [Fact]
    public void Validate_ValidRequest_PassesAllValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyStorageKey_FailsValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "",
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.StorageKey)
            .WithErrorMessage("Storage key is required");
    }

    [Fact]
    public void Validate_EmptyThumbnailStorageKey_FailsValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "",
            "image/jpeg",
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ThumbnailStorageKey)
            .WithErrorMessage("Thumbnail storage key is required");
    }

    [Fact]
    public void Validate_StorageKeyTooLong_FailsValidation()
    {
        // Arrange
        var longKey = new string('a', 501);
        var command = new ConfirmPhotoUploadCommand(
            longKey,
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.StorageKey);
    }

    [Fact]
    public void Validate_ThumbnailStorageKeyTooLong_FailsValidation()
    {
        // Arrange
        var longKey = new string('a', 501);
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            longKey,
            "image/jpeg",
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ThumbnailStorageKey);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/gif")]
    [InlineData("image/webp")]
    [InlineData("image/bmp")]
    [InlineData("image/tiff")]
    public void Validate_ValidContentType_PassesValidation(string contentType)
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            contentType,
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.ContentType);
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("text/plain")]
    [InlineData("video/mp4")]
    public void Validate_InvalidContentType_FailsValidation(string invalidContentType)
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            invalidContentType,
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Fact]
    public void Validate_EmptyContentType_FailsValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            "",
            1024);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Fact]
    public void Validate_FileSizeZero_FailsValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            0);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes)
            .WithErrorMessage("File size must be greater than 0");
    }

    [Fact]
    public void Validate_FileSizeNegative_FailsValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            -1);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_FileSizeExceeds10MB_FailsValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            PhotoValidation.MaxFileSizeBytes + 1);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_FileSizeExactly10MB_PassesValidation()
    {
        // Arrange
        var command = new ConfirmPhotoUploadCommand(
            "account123/Properties/2026/abc.jpg",
            "account123/Properties/2026/abc_thumb.jpg",
            "image/jpeg",
            PhotoValidation.MaxFileSizeBytes);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.FileSizeBytes);
    }
}
