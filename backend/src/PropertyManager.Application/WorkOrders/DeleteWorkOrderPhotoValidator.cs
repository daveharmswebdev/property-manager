using FluentValidation;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for DeleteWorkOrderPhotoCommand.
/// </summary>
public class DeleteWorkOrderPhotoValidator : AbstractValidator<DeleteWorkOrderPhotoCommand>
{
    public DeleteWorkOrderPhotoValidator()
    {
        RuleFor(x => x.WorkOrderId)
            .NotEmpty().WithMessage("Work order ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
