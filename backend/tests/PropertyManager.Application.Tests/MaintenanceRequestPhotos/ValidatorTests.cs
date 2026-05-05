using FluentAssertions;
using PropertyManager.Application.MaintenanceRequestPhotos;

namespace PropertyManager.Application.Tests.MaintenanceRequestPhotos;

/// <summary>
/// Unit tests for MaintenanceRequestPhoto validators (AC #2, #3, #6).
/// </summary>
public class ValidatorTests
{
    #region GenerateMaintenanceRequestPhotoUploadUrlValidator Tests

    [Fact]
    public void GenerateUploadUrlValidator_ValidRequest_Passes()
    {
        var validator = new GenerateMaintenanceRequestPhotoUploadUrlValidator();
        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(Guid.NewGuid(), "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void GenerateUploadUrlValidator_EmptyMaintenanceRequestId_Fails()
    {
        var validator = new GenerateMaintenanceRequestPhotoUploadUrlValidator();
        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(Guid.Empty, "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "MaintenanceRequestId" && e.ErrorMessage == "Maintenance request ID is required");
    }

    [Fact]
    public void GenerateUploadUrlValidator_InvalidContentType_Fails()
    {
        var validator = new GenerateMaintenanceRequestPhotoUploadUrlValidator();
        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(Guid.NewGuid(), "application/pdf", 1024, "test.pdf");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ContentType" && e.ErrorMessage == "Content type must be one of: image/jpeg, image/png, image/gif, image/webp, image/bmp, image/tiff");
    }

    [Fact]
    public void GenerateUploadUrlValidator_FileSizeExceedsMax_Fails()
    {
        var validator = new GenerateMaintenanceRequestPhotoUploadUrlValidator();
        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(Guid.NewGuid(), "image/jpeg", 20 * 1024 * 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FileSizeBytes" && e.ErrorMessage == "File size must not exceed 10MB");
    }

    [Fact]
    public void GenerateUploadUrlValidator_EmptyFileName_Fails()
    {
        var validator = new GenerateMaintenanceRequestPhotoUploadUrlValidator();
        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(Guid.NewGuid(), "image/jpeg", 1024, "");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "OriginalFileName" && e.ErrorMessage == "Original file name is required");
    }

    #endregion

    #region ConfirmMaintenanceRequestPhotoUploadValidator Tests

    [Fact]
    public void ConfirmUploadValidator_ValidRequest_Passes()
    {
        var validator = new ConfirmMaintenanceRequestPhotoUploadValidator();
        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            Guid.NewGuid(), "account-id/maintenancerequests/2026/test.jpg",
            "account-id/maintenancerequests/2026/thumbnails/test.jpg",
            "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ConfirmUploadValidator_EmptyStorageKey_Fails()
    {
        var validator = new ConfirmMaintenanceRequestPhotoUploadValidator();
        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            Guid.NewGuid(), "",
            "account-id/maintenancerequests/2026/thumbnails/test.jpg",
            "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "StorageKey" && e.ErrorMessage == "Storage key is required");
    }

    [Fact]
    public void ConfirmUploadValidator_EmptyThumbnailStorageKey_Fails()
    {
        var validator = new ConfirmMaintenanceRequestPhotoUploadValidator();
        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            Guid.NewGuid(), "account-id/maintenancerequests/2026/test.jpg", "",
            "image/jpeg", 1024, "test.jpg");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ThumbnailStorageKey" && e.ErrorMessage == "Thumbnail storage key is required");
    }

    #endregion

    #region DeleteMaintenanceRequestPhotoValidator Tests

    [Fact]
    public void DeleteValidator_ValidRequest_Passes()
    {
        var validator = new DeleteMaintenanceRequestPhotoValidator();
        var command = new DeleteMaintenanceRequestPhotoCommand(Guid.NewGuid(), Guid.NewGuid());

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void DeleteValidator_EmptyMaintenanceRequestId_Fails()
    {
        var validator = new DeleteMaintenanceRequestPhotoValidator();
        var command = new DeleteMaintenanceRequestPhotoCommand(Guid.Empty, Guid.NewGuid());

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "MaintenanceRequestId" && e.ErrorMessage == "Maintenance request ID is required");
    }

    [Fact]
    public void DeleteValidator_EmptyPhotoId_Fails()
    {
        var validator = new DeleteMaintenanceRequestPhotoValidator();
        var command = new DeleteMaintenanceRequestPhotoCommand(Guid.NewGuid(), Guid.Empty);

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PhotoId" && e.ErrorMessage == "Photo ID is required");
    }

    #endregion
}
