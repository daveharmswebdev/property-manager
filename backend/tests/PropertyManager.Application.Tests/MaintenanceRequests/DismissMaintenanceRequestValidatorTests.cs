using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.MaintenanceRequests;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for <see cref="DismissMaintenanceRequestValidator"/> (Story 20.9, AC #15, #16).
/// </summary>
public class DismissMaintenanceRequestValidatorTests
{
    private readonly DismissMaintenanceRequestValidator _validator = new();

    [Fact]
    public async Task Valid_OneCharReason_NoErrors()
    {
        var cmd = new DismissMaintenanceRequestCommand(Guid.NewGuid(), "x");

        var result = await _validator.TestValidateAsync(cmd);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Valid_Exactly2000CharReason_NoErrors()
    {
        var cmd = new DismissMaintenanceRequestCommand(Guid.NewGuid(), new string('x', 2000));

        var result = await _validator.TestValidateAsync(cmd);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Invalid_EmptyReason_ReturnsRequiredError()
    {
        var cmd = new DismissMaintenanceRequestCommand(Guid.NewGuid(), "");

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Reason is required");
    }

    [Fact]
    public async Task Invalid_WhitespaceReason_ReturnsRequiredError()
    {
        // FluentValidation NotEmpty() on a string rejects whitespace-only — AC #15.
        var cmd = new DismissMaintenanceRequestCommand(Guid.NewGuid(), "   ");

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Reason is required");
    }

    [Fact]
    public async Task Invalid_NullReason_ReturnsRequiredError()
    {
        var cmd = new DismissMaintenanceRequestCommand(Guid.NewGuid(), null!);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Reason is required");
    }

    [Fact]
    public async Task Invalid_ReasonOver2000Chars_ReturnsMaxLengthError()
    {
        var cmd = new DismissMaintenanceRequestCommand(Guid.NewGuid(), new string('x', 2001));

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Reason)
            .WithErrorMessage("Reason must be 2000 characters or less");
    }

    [Fact]
    public async Task Invalid_EmptyMaintenanceRequestId_ReturnsError()
    {
        var cmd = new DismissMaintenanceRequestCommand(Guid.Empty, "Reason");

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.MaintenanceRequestId)
            .WithErrorMessage("Maintenance request id is required");
    }
}
