using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.Receipts;

namespace PropertyManager.Application.Tests.Receipts;

/// <summary>
/// Unit tests for GenerateUploadUrlValidator (AC-5.1.6).
/// </summary>
public class GenerateUploadUrlValidatorTests
{
    private readonly GenerateUploadUrlValidator _validator;

    public GenerateUploadUrlValidatorTests()
    {
        _validator = new GenerateUploadUrlValidator();
    }

    [Fact]
    public void Validate_ValidJpegRequest_PassesValidation()
    {
        // Arrange
        var command = new GenerateUploadUrlCommand("image/jpeg", 1024 * 1024, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidPngRequest_PassesValidation()
    {
        // Arrange
        var command = new GenerateUploadUrlCommand("image/png", 1024 * 1024, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidPdfRequest_PassesValidation()
    {
        // Arrange
        var command = new GenerateUploadUrlCommand("application/pdf", 1024 * 1024, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("image/gif")]
    [InlineData("image/webp")]
    [InlineData("text/plain")]
    [InlineData("application/json")]
    [InlineData("video/mp4")]
    public void Validate_InvalidContentType_FailsValidation(string invalidContentType)
    {
        // Arrange
        var command = new GenerateUploadUrlCommand(invalidContentType, 1024 * 1024, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ContentType)
            .WithErrorMessage($"Content type must be one of: {string.Join(", ", GenerateUploadUrlValidator.AllowedContentTypes)}");
    }

    [Fact]
    public void Validate_EmptyContentType_FailsValidation()
    {
        // Arrange
        var command = new GenerateUploadUrlCommand("", 1024 * 1024, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Fact]
    public void Validate_FileSizeExceeds10MB_FailsValidation()
    {
        // Arrange
        var tenMBPlusOne = (10 * 1024 * 1024) + 1;
        var command = new GenerateUploadUrlCommand("image/jpeg", tenMBPlusOne, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes)
            .WithErrorMessage("File size must not exceed 10MB");
    }

    [Fact]
    public void Validate_FileSizeExactly10MB_PassesValidation()
    {
        // Arrange
        var tenMB = 10 * 1024 * 1024;
        var command = new GenerateUploadUrlCommand("image/jpeg", tenMB, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_FileSizeZero_FailsValidation()
    {
        // Arrange
        var command = new GenerateUploadUrlCommand("image/jpeg", 0, null);

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
        var command = new GenerateUploadUrlCommand("image/jpeg", -1, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void Validate_ContentTypeCaseInsensitive_PassesValidation()
    {
        // Arrange - using uppercase
        var command = new GenerateUploadUrlCommand("IMAGE/JPEG", 1024 * 1024, null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
