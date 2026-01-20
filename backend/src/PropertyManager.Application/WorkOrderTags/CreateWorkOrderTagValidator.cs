using FluentValidation;

namespace PropertyManager.Application.WorkOrderTags;

/// <summary>
/// Validator for CreateWorkOrderTagCommand (AC #4).
/// </summary>
public class CreateWorkOrderTagValidator : AbstractValidator<CreateWorkOrderTagCommand>
{
    public CreateWorkOrderTagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(100).WithMessage("Name must be 100 characters or less");
    }
}
