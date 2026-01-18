using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.Vendors;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for DeleteVendorCommandValidator.
/// </summary>
public class DeleteVendorValidatorTests
{
    private readonly DeleteVendorCommandValidator _validator = new();

    [Fact]
    public void Validate_ValidId_NoErrors()
    {
        // Arrange
        var command = new DeleteVendorCommand(Guid.NewGuid());

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyId_HasError()
    {
        // Arrange
        var command = new DeleteVendorCommand(Guid.Empty);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Vendor ID is required");
    }
}
