using FluentAssertions;
using PropertyManager.Application.PropertyPhotos;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for PropertyPhoto validators (AC-13.3a.11).
/// </summary>
public class ValidatorTests
{
    #region GeneratePropertyPhotoUploadUrlValidator Tests

    [Fact]
    public void GenerateUploadUrlValidator_ValidRequest_Passes()
    {
        // Arrange
        var validator = new GeneratePropertyPhotoUploadUrlValidator();
        var command = new GeneratePropertyPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void GenerateUploadUrlValidator_EmptyPropertyId_Fails()
    {
        // Arrange
        var validator = new GeneratePropertyPhotoUploadUrlValidator();
        var command = new GeneratePropertyPhotoUploadUrlCommand(
            Guid.Empty,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PropertyId");
    }

    [Fact]
    public void GenerateUploadUrlValidator_InvalidContentType_Fails()
    {
        // Arrange
        var validator = new GeneratePropertyPhotoUploadUrlValidator();
        var command = new GeneratePropertyPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "application/pdf",
            1024,
            "test.pdf");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ContentType");
    }

    [Fact]
    public void GenerateUploadUrlValidator_FileSizeExceedsMax_Fails()
    {
        // Arrange
        var validator = new GeneratePropertyPhotoUploadUrlValidator();
        var command = new GeneratePropertyPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            20 * 1024 * 1024, // 20MB - exceeds 10MB limit
            "test.jpg");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FileSizeBytes");
    }

    [Fact]
    public void GenerateUploadUrlValidator_EmptyFileName_Fails()
    {
        // Arrange
        var validator = new GeneratePropertyPhotoUploadUrlValidator();
        var command = new GeneratePropertyPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "OriginalFileName");
    }

    #endregion

    #region ConfirmPropertyPhotoUploadValidator Tests

    [Fact]
    public void ConfirmUploadValidator_ValidRequest_Passes()
    {
        // Arrange
        var validator = new ConfirmPropertyPhotoUploadValidator();
        var command = new ConfirmPropertyPhotoUploadCommand(
            Guid.NewGuid(),
            "account-id/properties/2026/test.jpg",
            "account-id/properties/2026/thumbnails/test.jpg",
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ConfirmUploadValidator_EmptyStorageKey_Fails()
    {
        // Arrange
        var validator = new ConfirmPropertyPhotoUploadValidator();
        var command = new ConfirmPropertyPhotoUploadCommand(
            Guid.NewGuid(),
            "",
            "account-id/properties/2026/thumbnails/test.jpg",
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "StorageKey");
    }

    [Fact]
    public void ConfirmUploadValidator_EmptyThumbnailStorageKey_Fails()
    {
        // Arrange
        var validator = new ConfirmPropertyPhotoUploadValidator();
        var command = new ConfirmPropertyPhotoUploadCommand(
            Guid.NewGuid(),
            "account-id/properties/2026/test.jpg",
            "",
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ThumbnailStorageKey");
    }

    #endregion

    #region DeletePropertyPhotoValidator Tests

    [Fact]
    public void DeleteValidator_ValidRequest_Passes()
    {
        // Arrange
        var validator = new DeletePropertyPhotoValidator();
        var command = new DeletePropertyPhotoCommand(
            Guid.NewGuid(),
            Guid.NewGuid());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void DeleteValidator_EmptyPropertyId_Fails()
    {
        // Arrange
        var validator = new DeletePropertyPhotoValidator();
        var command = new DeletePropertyPhotoCommand(
            Guid.Empty,
            Guid.NewGuid());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PropertyId");
    }

    [Fact]
    public void DeleteValidator_EmptyPhotoId_Fails()
    {
        // Arrange
        var validator = new DeletePropertyPhotoValidator();
        var command = new DeletePropertyPhotoCommand(
            Guid.NewGuid(),
            Guid.Empty);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoId");
    }

    #endregion

    #region SetPrimaryPropertyPhotoValidator Tests

    [Fact]
    public void SetPrimaryValidator_ValidRequest_Passes()
    {
        // Arrange
        var validator = new SetPrimaryPropertyPhotoValidator();
        var command = new SetPrimaryPropertyPhotoCommand(
            Guid.NewGuid(),
            Guid.NewGuid());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void SetPrimaryValidator_EmptyPropertyId_Fails()
    {
        // Arrange
        var validator = new SetPrimaryPropertyPhotoValidator();
        var command = new SetPrimaryPropertyPhotoCommand(
            Guid.Empty,
            Guid.NewGuid());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PropertyId");
    }

    #endregion

    #region ReorderPropertyPhotosValidator Tests

    [Fact]
    public void ReorderValidator_ValidRequest_Passes()
    {
        // Arrange
        var validator = new ReorderPropertyPhotosValidator();
        var command = new ReorderPropertyPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid(), Guid.NewGuid() });

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ReorderValidator_EmptyPhotoIds_Fails()
    {
        // Arrange
        var validator = new ReorderPropertyPhotosValidator();
        var command = new ReorderPropertyPhotosCommand(
            Guid.NewGuid(),
            new List<Guid>());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoIds");
    }

    [Fact]
    public void ReorderValidator_NullPhotoIds_Fails()
    {
        // Arrange
        var validator = new ReorderPropertyPhotosValidator();
        var command = new ReorderPropertyPhotosCommand(
            Guid.NewGuid(),
            null!);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoIds");
    }

    [Fact]
    public void ReorderValidator_PhotoIdsContainsEmptyGuid_Fails()
    {
        // Arrange
        var validator = new ReorderPropertyPhotosValidator();
        var command = new ReorderPropertyPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid(), Guid.Empty, Guid.NewGuid() });

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    #endregion
}
