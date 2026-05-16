using FluentValidation;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Validator for <see cref="DismissMaintenanceRequestCommand"/> (Story 20.9, AC #15, #16).
/// <para>
/// <c>NotEmpty()</c> in FluentValidation rejects null, empty, and whitespace-only
/// strings out of the box for <see cref="string"/> properties — covers AC #15.
/// </para>
/// </summary>
public class DismissMaintenanceRequestValidator
    : AbstractValidator<DismissMaintenanceRequestCommand>
{
    public DismissMaintenanceRequestValidator()
    {
        RuleFor(x => x.MaintenanceRequestId)
            .NotEmpty().WithMessage("Maintenance request id is required");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Reason is required")
            .MaximumLength(2000).WithMessage("Reason must be 2000 characters or less");
    }
}
