using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.Vendors;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for CreateVendorValidator (AC #8).
/// </summary>
public class CreateVendorValidatorTests
{
    private readonly CreateVendorValidator _validator = new();

    [Fact]
    public void Validate_ValidCommand_NoErrors()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithMiddleName_NoErrors()
    {
        // Arrange
        var command = new CreateVendorCommand("John", "Allen", "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyFirstName_HasError(string? firstName)
    {
        // Arrange
        var command = new CreateVendorCommand(firstName!, null, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name is required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyLastName_HasError(string? lastName)
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, lastName!);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name is required");
    }

    [Fact]
    public void Validate_FirstNameTooLong_HasError()
    {
        // Arrange
        var longName = new string('A', 101);
        var command = new CreateVendorCommand(longName, null, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name must be 100 characters or less");
    }

    [Fact]
    public void Validate_LastNameTooLong_HasError()
    {
        // Arrange
        var longName = new string('A', 101);
        var command = new CreateVendorCommand("John", null, longName);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name must be 100 characters or less");
    }

    [Fact]
    public void Validate_MiddleNameTooLong_HasError()
    {
        // Arrange
        var longName = new string('A', 101);
        var command = new CreateVendorCommand("John", longName, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.MiddleName)
            .WithErrorMessage("Middle name must be 100 characters or less");
    }

    [Fact]
    public void Validate_FirstNameMaxLength_NoError()
    {
        // Arrange
        var maxName = new string('A', 100);
        var command = new CreateVendorCommand(maxName, null, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void Validate_LastNameMaxLength_NoError()
    {
        // Arrange
        var maxName = new string('A', 100);
        var command = new CreateVendorCommand("John", null, maxName);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void Validate_MiddleNameMaxLength_NoError()
    {
        // Arrange
        var maxName = new string('A', 100);
        var command = new CreateVendorCommand("John", maxName, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.MiddleName);
    }

    [Fact]
    public void Validate_NullMiddleName_NoError()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.MiddleName);
    }
}
