using FluentValidation;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for CreateWorkOrderCommand (AC #3, #5).
/// </summary>
public class CreateWorkOrderValidator : AbstractValidator<CreateWorkOrderCommand>
{
    public CreateWorkOrderValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Property is required");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(5000).WithMessage("Description must be 5000 characters or less");

        RuleFor(x => x.Status)
            .Must(BeValidStatusOrEmpty)
            .WithMessage("Status must be one of: Reported, Assigned, Completed")
            .When(x => !string.IsNullOrEmpty(x.Status));
    }

    private static bool BeValidStatusOrEmpty(string? status)
    {
        if (string.IsNullOrEmpty(status))
            return true;

        return Enum.TryParse<WorkOrderStatus>(status, ignoreCase: true, out _);
    }
}
