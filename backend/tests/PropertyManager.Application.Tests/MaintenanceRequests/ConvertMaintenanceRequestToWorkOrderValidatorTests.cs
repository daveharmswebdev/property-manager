using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.MaintenanceRequests;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for ConvertMaintenanceRequestToWorkOrderValidator (Story 20.8, AC #15).
/// </summary>
public class ConvertMaintenanceRequestToWorkOrderValidatorTests
{
    private readonly ConvertMaintenanceRequestToWorkOrderValidator _validator = new();

    [Fact]
    public async Task Valid_AllFieldsPopulated_NoErrors()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(),
            "Fix leaky faucet",
            Guid.NewGuid(),
            Guid.NewGuid());

        var result = await _validator.TestValidateAsync(cmd);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Valid_NullOptionalIds_NoErrors()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(),
            "Fix leaky faucet",
            null,
            null);

        var result = await _validator.TestValidateAsync(cmd);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Invalid_EmptyMaintenanceRequestId_ReturnsError()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.Empty, "Fix it", null, null);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.MaintenanceRequestId)
            .WithErrorMessage("Maintenance request id is required");
    }

    [Fact]
    public async Task Invalid_EmptyDescription_ReturnsError()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(), "", null, null);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description is required");
    }

    [Fact]
    public async Task Invalid_WhitespaceDescription_ReturnsError()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(), "   ", null, null);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public async Task Invalid_DescriptionTooLong_ReturnsError()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(), new string('x', 5001), null, null);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description must be 5000 characters or less");
    }

    [Fact]
    public async Task Invalid_EmptyCategoryIdGuid_ReturnsError()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(), "Fix it", Guid.Empty, null);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.CategoryId)
            .WithErrorMessage("Category ID must be a valid non-empty GUID");
    }

    [Fact]
    public async Task Invalid_EmptyVendorIdGuid_ReturnsError()
    {
        var cmd = new ConvertMaintenanceRequestToWorkOrderCommand(
            Guid.NewGuid(), "Fix it", null, Guid.Empty);

        var result = await _validator.TestValidateAsync(cmd);

        result.ShouldHaveValidationErrorFor(x => x.VendorId)
            .WithErrorMessage("Vendor ID must be a valid non-empty GUID");
    }
}
