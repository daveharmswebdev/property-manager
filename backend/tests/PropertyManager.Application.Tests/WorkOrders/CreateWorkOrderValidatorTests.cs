using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for CreateWorkOrderValidator (AC #3, #5).
/// </summary>
public class CreateWorkOrderValidatorTests
{
    private readonly CreateWorkOrderValidator _validator = new();

    [Fact]
    public void Validate_ValidMinimalCommand_NoErrors()
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Leaky faucet in kitchen",
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidFullCommand_NoErrors()
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Leaky faucet in kitchen",
            Guid.NewGuid(),
            "Assigned");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyPropertyId_HasError()
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.Empty,
            "Leaky faucet",
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PropertyId)
            .WithErrorMessage("Property is required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyDescription_HasError(string? description)
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            description!,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description is required");
    }

    [Fact]
    public void Validate_DescriptionTooLong_HasError()
    {
        // Arrange
        var longDescription = new string('A', 5001);
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            longDescription,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description must be 5000 characters or less");
    }

    [Fact]
    public void Validate_DescriptionMaxLength_NoError()
    {
        // Arrange
        var maxDescription = new string('A', 5000);
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            maxDescription,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Validate_InvalidStatus_HasError()
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Fix the door",
            null,
            "InvalidStatus");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Status)
            .WithErrorMessage("Status must be one of: Reported, Assigned, Completed");
    }

    [Theory]
    [InlineData("Reported")]
    [InlineData("reported")]
    [InlineData("REPORTED")]
    [InlineData("Assigned")]
    [InlineData("assigned")]
    [InlineData("ASSIGNED")]
    [InlineData("Completed")]
    [InlineData("completed")]
    [InlineData("COMPLETED")]
    public void Validate_ValidStatusCaseInsensitive_NoError(string status)
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Fix the door",
            null,
            status);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Validate_NullStatus_NoError()
    {
        // Arrange
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Fix the door",
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Validate_EmptyStringStatus_NoError()
    {
        // Arrange - Empty string should be treated like null (default to Reported)
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Fix the door",
            null,
            "");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Validate_NullCategoryId_NoError()
    {
        // Arrange - CategoryId is optional
        var command = new CreateWorkOrderCommand(
            Guid.NewGuid(),
            "Fix the door",
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.CategoryId);
    }
}
