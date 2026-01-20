using FluentValidation;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for UpdateWorkOrderCommand (AC #6).
/// </summary>
public class UpdateWorkOrderValidator : AbstractValidator<UpdateWorkOrderCommand>
{
    public UpdateWorkOrderValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Work order ID is required");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(5000).WithMessage("Description must be 5000 characters or less");

        RuleFor(x => x.Status)
            .Must(BeValidStatusOrEmpty)
            .WithMessage("Status must be one of: Reported, Assigned, Completed")
            .When(x => !string.IsNullOrEmpty(x.Status));

        // Validate TagIds: each ID must be non-empty when list is provided
        RuleFor(x => x.TagIds)
            .Must(tagIds => tagIds == null || tagIds.All(id => id != Guid.Empty))
            .WithMessage("Each tag ID must be a valid non-empty GUID");
    }

    private static bool BeValidStatusOrEmpty(string? status)
    {
        if (string.IsNullOrEmpty(status))
            return true;

        return Enum.TryParse<WorkOrderStatus>(status, ignoreCase: true, out _);
    }
}
