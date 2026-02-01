using FluentValidation;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for ReorderWorkOrderPhotosCommand.
/// </summary>
public class ReorderWorkOrderPhotosValidator : AbstractValidator<ReorderWorkOrderPhotosCommand>
{
    public ReorderWorkOrderPhotosValidator()
    {
        RuleFor(x => x.WorkOrderId)
            .NotEmpty().WithMessage("Work Order ID is required");

        RuleFor(x => x.PhotoIds)
            .NotNull().WithMessage("Photo IDs are required")
            .NotEmpty().WithMessage("Photo IDs cannot be empty");

        RuleForEach(x => x.PhotoIds)
            .NotEmpty().WithMessage("Photo ID cannot be empty");
    }
}
