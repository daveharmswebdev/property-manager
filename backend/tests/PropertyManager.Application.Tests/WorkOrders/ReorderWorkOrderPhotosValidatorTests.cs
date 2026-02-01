using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for ReorderWorkOrderPhotosValidator.
/// Tests validation rules including duplicate ID detection (#142).
/// </summary>
public class ReorderWorkOrderPhotosValidatorTests
{
    private readonly ReorderWorkOrderPhotosValidator _validator = new();

    [Fact]
    public void Validate_ValidCommand_NoErrors()
    {
        // Arrange
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyWorkOrderId_HasError()
    {
        // Arrange
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.Empty,
            new List<Guid> { Guid.NewGuid() });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.WorkOrderId)
            .WithErrorMessage("Work Order ID is required");
    }

    [Fact]
    public void Validate_NullPhotoIds_HasError()
    {
        // Arrange
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            null!);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PhotoIds)
            .WithErrorMessage("Photo IDs are required");
    }

    [Fact]
    public void Validate_EmptyPhotoIds_HasError()
    {
        // Arrange
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            new List<Guid>());

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PhotoIds)
            .WithErrorMessage("Photo IDs cannot be empty");
    }

    [Fact]
    public void Validate_EmptyGuidInPhotoIds_HasError()
    {
        // Arrange
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid(), Guid.Empty, Guid.NewGuid() });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("PhotoIds[1]")
            .WithErrorMessage("Photo ID cannot be empty");
    }

    [Fact]
    public void Validate_DuplicatePhotoIds_HasError()
    {
        // Arrange - Issue #142: duplicate ID validation
        var duplicateId = Guid.NewGuid();
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { duplicateId, Guid.NewGuid(), duplicateId });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PhotoIds)
            .WithErrorMessage("Photo IDs must not contain duplicates");
    }

    [Fact]
    public void Validate_AllSamePhotoId_HasError()
    {
        // Arrange - Edge case: all IDs are duplicates
        var sameId = Guid.NewGuid();
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { sameId, sameId, sameId });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PhotoIds)
            .WithErrorMessage("Photo IDs must not contain duplicates");
    }

    [Fact]
    public void Validate_SinglePhotoId_NoErrors()
    {
        // Arrange - Single photo should be valid
        var command = new ReorderWorkOrderPhotosCommand(
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid() });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
