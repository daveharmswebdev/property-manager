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

        // Validate TagIds: each ID must be non-empty when list is provided
        RuleFor(x => x.TagIds)
            .Must(tagIds => tagIds == null || tagIds.All(id => id != Guid.Empty))
            .WithMessage("Each tag ID must be a valid non-empty GUID");

        // Validate VendorId: must be non-empty GUID when provided
        RuleFor(x => x.VendorId)
            .NotEqual(Guid.Empty)
            .WithMessage("Vendor ID must be a valid non-empty GUID")
            .When(x => x.VendorId.HasValue);
    }

    private static bool BeValidStatusOrEmpty(string? status)
    {
        if (string.IsNullOrEmpty(status))
            return true;

        return Enum.TryParse<WorkOrderStatus>(status, ignoreCase: true, out _);
    }
}
