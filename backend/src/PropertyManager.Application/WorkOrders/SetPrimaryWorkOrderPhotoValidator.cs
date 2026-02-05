using FluentValidation;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for SetPrimaryWorkOrderPhotoCommand.
/// </summary>
public class SetPrimaryWorkOrderPhotoValidator : AbstractValidator<SetPrimaryWorkOrderPhotoCommand>
{
    public SetPrimaryWorkOrderPhotoValidator()
    {
        RuleFor(x => x.WorkOrderId)
            .NotEmpty().WithMessage("Work Order ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
