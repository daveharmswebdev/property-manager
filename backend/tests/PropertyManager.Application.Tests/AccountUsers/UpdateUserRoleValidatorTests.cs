using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.AccountUsers;

namespace PropertyManager.Application.Tests.AccountUsers;

/// <summary>
/// Unit tests for UpdateUserRoleValidator (AC #2).
/// </summary>
public class UpdateUserRoleValidatorTests
{
    private readonly UpdateUserRoleValidator _validator = new();

    [Fact]
    public void Validate_EmptyRole_Fails()
    {
        // Arrange
        var command = new UpdateUserRoleCommand(Guid.NewGuid(), string.Empty);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Role)
            .WithErrorMessage("Role is required");
    }

    [Fact]
    public void Validate_InvalidRole_Fails()
    {
        // Arrange
        var command = new UpdateUserRoleCommand(Guid.NewGuid(), "Admin");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Role)
            .WithErrorMessage("Role must be 'Owner' or 'Contributor'");
    }

    [Fact]
    public void Validate_ValidOwnerRole_Passes()
    {
        // Arrange
        var command = new UpdateUserRoleCommand(Guid.NewGuid(), "Owner");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidContributorRole_Passes()
    {
        // Arrange
        var command = new UpdateUserRoleCommand(Guid.NewGuid(), "Contributor");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyUserId_Fails()
    {
        // Arrange
        var command = new UpdateUserRoleCommand(Guid.Empty, "Owner");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.UserId)
            .WithErrorMessage("UserId is required");
    }
}
