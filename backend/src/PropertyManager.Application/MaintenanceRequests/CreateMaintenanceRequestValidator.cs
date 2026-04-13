using FluentValidation;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Validator for CreateMaintenanceRequestCommand (AC #4).
/// </summary>
public class CreateMaintenanceRequestValidator : AbstractValidator<CreateMaintenanceRequestCommand>
{
    public CreateMaintenanceRequestValidator()
    {
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(5000).WithMessage("Description must be 5000 characters or less");
    }
}
