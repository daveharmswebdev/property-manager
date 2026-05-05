using FluentAssertions;
using PropertyManager.Application.MaintenanceRequests;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for CreateMaintenanceRequestValidator (AC #4).
/// </summary>
public class CreateMaintenanceRequestValidatorTests
{
    private readonly CreateMaintenanceRequestValidator _validator = new();

    [Fact]
    public async Task Validate_EmptyDescription_Fails()
    {
        var command = new CreateMaintenanceRequestCommand("");

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Description" && e.ErrorMessage == "Description is required");
    }

    [Fact]
    public async Task Validate_DescriptionOver5000Chars_Fails()
    {
        var command = new CreateMaintenanceRequestCommand(new string('a', 5001));

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Description" && e.ErrorMessage == "Description must be 5000 characters or less");
    }

    [Fact]
    public async Task Validate_ValidDescription_Passes()
    {
        var command = new CreateMaintenanceRequestCommand("Leaky faucet in the kitchen");

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeTrue();
    }
}
