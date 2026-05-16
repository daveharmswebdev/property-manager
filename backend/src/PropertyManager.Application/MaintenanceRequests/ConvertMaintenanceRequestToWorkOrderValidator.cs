using FluentValidation;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Validator for <see cref="ConvertMaintenanceRequestToWorkOrderCommand"/> (Story 20.8, AC #15).
/// </summary>
public class ConvertMaintenanceRequestToWorkOrderValidator
    : AbstractValidator<ConvertMaintenanceRequestToWorkOrderCommand>
{
    public ConvertMaintenanceRequestToWorkOrderValidator()
    {
        RuleFor(x => x.MaintenanceRequestId)
            .NotEmpty().WithMessage("Maintenance request id is required");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(5000).WithMessage("Description must be 5000 characters or less");

        RuleFor(x => x.CategoryId)
            .NotEqual(Guid.Empty)
            .When(x => x.CategoryId.HasValue)
            .WithMessage("Category ID must be a valid non-empty GUID");

        RuleFor(x => x.VendorId)
            .NotEqual(Guid.Empty)
            .When(x => x.VendorId.HasValue)
            .WithMessage("Vendor ID must be a valid non-empty GUID");
    }
}
