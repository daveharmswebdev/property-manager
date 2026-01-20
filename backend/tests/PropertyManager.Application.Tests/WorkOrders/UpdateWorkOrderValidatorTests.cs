using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for UpdateWorkOrderValidator (AC #6).
/// </summary>
public class UpdateWorkOrderValidatorTests
{
    private readonly UpdateWorkOrderValidator _validator = new();

    [Fact]
    public void Validate_ValidMinimalCommand_NoErrors()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            null,
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
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            Guid.NewGuid(),
            "Assigned",
            Guid.NewGuid(),
            new List<Guid> { Guid.NewGuid(), Guid.NewGuid() });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyWorkOrderId_HasError()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.Empty,
            "Updated description",
            null,
            null,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Work order ID is required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyDescription_HasError(string? description)
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            description!,
            null,
            null,
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
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            longDescription,
            null,
            null,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description must be 5000 characters or less");
    }

    [Fact]
    public void Validate_InvalidStatus_HasError()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            "InvalidStatus",
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Status)
            .WithErrorMessage("Status must be one of: Reported, Assigned, Completed");
    }

    [Theory]
    [InlineData("Reported")]
    [InlineData("reported")]
    [InlineData("ASSIGNED")]
    [InlineData("Completed")]
    public void Validate_ValidStatus_NoError(string status)
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            status,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Validate_NullStatus_NoError()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            null,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
    }

    [Fact]
    public void Validate_TagIdsContainsEmptyGuid_HasError()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            null,
            null,
            new List<Guid> { Guid.NewGuid(), Guid.Empty });

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.TagIds);
    }

    [Fact]
    public void Validate_NullTagIds_NoError()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            null,
            null,
            null);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }

    [Fact]
    public void Validate_EmptyTagIdsList_NoError()
    {
        // Arrange
        var command = new UpdateWorkOrderCommand(
            Guid.NewGuid(),
            "Updated description",
            null,
            null,
            null,
            new List<Guid>());

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }
}
