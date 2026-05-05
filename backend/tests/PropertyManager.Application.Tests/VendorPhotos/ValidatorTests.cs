using FluentAssertions;
using PropertyManager.Application.VendorPhotos;

namespace PropertyManager.Application.Tests.VendorPhotos;

/// <summary>
/// Unit tests for VendorPhoto validators.
/// </summary>
public class ValidatorTests
{
    #region GenerateVendorPhotoUploadUrlValidator Tests

    [Fact]
    public void GenerateUploadUrlValidator_ValidRequest_Passes()
    {
        var validator = new GenerateVendorPhotoUploadUrlValidator();
        var command = new GenerateVendorPhotoUploadUrlCommand(Guid.NewGuid(), "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void GenerateUploadUrlValidator_EmptyVendorId_Fails()
    {
        var validator = new GenerateVendorPhotoUploadUrlValidator();
        var command = new GenerateVendorPhotoUploadUrlCommand(Guid.Empty, "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "VendorId" && e.ErrorMessage == "Vendor ID is required");
    }

    [Fact]
    public void GenerateUploadUrlValidator_InvalidContentType_Fails()
    {
        var validator = new GenerateVendorPhotoUploadUrlValidator();
        var command = new GenerateVendorPhotoUploadUrlCommand(Guid.NewGuid(), "application/pdf", 1024, "test.pdf");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ContentType" && e.ErrorMessage == "Content type must be one of: image/jpeg, image/png, image/gif, image/webp, image/bmp, image/tiff");
    }

    [Fact]
    public void GenerateUploadUrlValidator_FileSizeExceedsMax_Fails()
    {
        var validator = new GenerateVendorPhotoUploadUrlValidator();
        var command = new GenerateVendorPhotoUploadUrlCommand(Guid.NewGuid(), "image/jpeg", 20 * 1024 * 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FileSizeBytes" && e.ErrorMessage == "File size must not exceed 10MB");
    }

    [Fact]
    public void GenerateUploadUrlValidator_EmptyFileName_Fails()
    {
        var validator = new GenerateVendorPhotoUploadUrlValidator();
        var command = new GenerateVendorPhotoUploadUrlCommand(Guid.NewGuid(), "image/jpeg", 1024, "");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "OriginalFileName" && e.ErrorMessage == "Original file name is required");
    }

    #endregion

    #region ConfirmVendorPhotoUploadValidator Tests

    [Fact]
    public void ConfirmUploadValidator_ValidRequest_Passes()
    {
        var validator = new ConfirmVendorPhotoUploadValidator();
        var command = new ConfirmVendorPhotoUploadCommand(
            Guid.NewGuid(), "account-id/vendors/2026/test.jpg", "account-id/vendors/2026/thumbnails/test.jpg",
            "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ConfirmUploadValidator_EmptyStorageKey_Fails()
    {
        var validator = new ConfirmVendorPhotoUploadValidator();
        var command = new ConfirmVendorPhotoUploadCommand(
            Guid.NewGuid(), "", "account-id/vendors/2026/thumbnails/test.jpg",
            "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "StorageKey" && e.ErrorMessage == "Storage key is required");
    }

    [Fact]
    public void ConfirmUploadValidator_EmptyThumbnailStorageKey_Fails()
    {
        var validator = new ConfirmVendorPhotoUploadValidator();
        var command = new ConfirmVendorPhotoUploadCommand(
            Guid.NewGuid(), "account-id/vendors/2026/test.jpg", "",
            "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ThumbnailStorageKey" && e.ErrorMessage == "Thumbnail storage key is required");
    }

    #endregion

    #region DeleteVendorPhotoValidator Tests

    [Fact]
    public void DeleteValidator_ValidRequest_Passes()
    {
        var validator = new DeleteVendorPhotoValidator();
        var command = new DeleteVendorPhotoCommand(Guid.NewGuid(), Guid.NewGuid());

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void DeleteValidator_EmptyVendorId_Fails()
    {
        var validator = new DeleteVendorPhotoValidator();
        var command = new DeleteVendorPhotoCommand(Guid.Empty, Guid.NewGuid());

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "VendorId" && e.ErrorMessage == "Vendor ID is required");
    }

    [Fact]
    public void DeleteValidator_EmptyPhotoId_Fails()
    {
        var validator = new DeleteVendorPhotoValidator();
        var command = new DeleteVendorPhotoCommand(Guid.NewGuid(), Guid.Empty);

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoId" && e.ErrorMessage == "Photo ID is required");
    }

    #endregion

    #region SetPrimaryVendorPhotoValidator Tests

    [Fact]
    public void SetPrimaryValidator_ValidRequest_Passes()
    {
        var validator = new SetPrimaryVendorPhotoValidator();
        var command = new SetPrimaryVendorPhotoCommand(Guid.NewGuid(), Guid.NewGuid());

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void SetPrimaryValidator_EmptyVendorId_Fails()
    {
        var validator = new SetPrimaryVendorPhotoValidator();
        var command = new SetPrimaryVendorPhotoCommand(Guid.Empty, Guid.NewGuid());

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "VendorId" && e.ErrorMessage == "Vendor ID is required");
    }

    #endregion

    #region ReorderVendorPhotosValidator Tests

    [Fact]
    public void ReorderValidator_ValidRequest_Passes()
    {
        var validator = new ReorderVendorPhotosValidator();
        var command = new ReorderVendorPhotosCommand(Guid.NewGuid(), new List<Guid> { Guid.NewGuid(), Guid.NewGuid() });

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ReorderValidator_EmptyPhotoIds_Fails()
    {
        var validator = new ReorderVendorPhotosValidator();
        var command = new ReorderVendorPhotosCommand(Guid.NewGuid(), new List<Guid>());

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoIds" && e.ErrorMessage == "Photo IDs cannot be empty");
    }

    [Fact]
    public void ReorderValidator_NullPhotoIds_Fails()
    {
        var validator = new ReorderVendorPhotosValidator();
        var command = new ReorderVendorPhotosCommand(Guid.NewGuid(), null!);

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoIds" && e.ErrorMessage == "Photo IDs are required");
    }

    [Fact]
    public void ReorderValidator_PhotoIdsContainsEmptyGuid_Fails()
    {
        var validator = new ReorderVendorPhotosValidator();
        var command = new ReorderVendorPhotosCommand(Guid.NewGuid(), new List<Guid> { Guid.NewGuid(), Guid.Empty, Guid.NewGuid() });

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == "Photo ID cannot be empty");
    }

    #endregion
}
