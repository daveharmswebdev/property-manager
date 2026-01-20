using FluentValidation.TestHelper;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Photos;

namespace PropertyManager.Application.Tests.Photos;

/// <summary>
/// Unit tests for GeneratePhotoUploadUrlValidator.
/// </summary>
public class GeneratePhotoUploadUrlValidatorTests
{
    private readonly GeneratePhotoUploadUrlValidator _validator;

    public GeneratePhotoUploadUrlValidatorTests()
    {
        _validator = new GeneratePhotoUploadUrlValidator();
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
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            contentType,
            1024 * 1024,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.ContentType);
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("text/plain")]
    [InlineData("application/json")]
    [InlineData("video/mp4")]
    [InlineData("audio/mp3")]
    public void Validate_InvalidContentType_FailsValidation(string invalidContentType)
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            invalidContentType,
            1024 * 1024,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Fact]
    public void Validate_EmptyContentType_FailsValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "",
            1024 * 1024,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Fact]
    public void Validate_FileSizeExceeds10MB_FailsValidation()
    {
        // Arrange
        var tenMBPlusOne = PhotoValidation.MaxFileSizeBytes + 1;
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            tenMBPlusOne,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_FileSizeExactly10MB_PassesValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            PhotoValidation.MaxFileSizeBytes,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_FileSizeZero_FailsValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            0,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes)
            .WithErrorMessage("File size must be greater than 0");
    }

    [Fact]
    public void Validate_NegativeFileSize_FailsValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            -1,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_EmptyEntityId_FailsValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.Empty,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.EntityId);
    }

    [Fact]
    public void Validate_EmptyOriginalFileName_FailsValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.OriginalFileName);
    }

    [Fact]
    public void Validate_OriginalFileNameTooLong_FailsValidation()
    {
        // Arrange
        var longFileName = new string('a', 256) + ".jpg";
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            longFileName);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.OriginalFileName);
    }

    [Theory]
    [InlineData(PhotoEntityType.Properties)]
    [InlineData(PhotoEntityType.Vendors)]
    [InlineData(PhotoEntityType.Users)]
    [InlineData(PhotoEntityType.Receipts)]
    public void Validate_ValidEntityType_PassesValidation(PhotoEntityType entityType)
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            entityType,
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.EntityType);
    }

    [Fact]
    public void Validate_ValidRequest_PassesAllValidation()
    {
        // Arrange
        var command = new GeneratePhotoUploadUrlCommand(
            PhotoEntityType.Properties,
            Guid.NewGuid(),
            "image/jpeg",
            1024 * 1024,
            "property-photo.jpg");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
