using FluentValidation;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Validator for SetPrimaryVendorPhotoCommand.
/// </summary>
public class SetPrimaryVendorPhotoValidator : AbstractValidator<SetPrimaryVendorPhotoCommand>
{
    public SetPrimaryVendorPhotoValidator()
    {
        RuleFor(x => x.VendorId)
            .NotEmpty().WithMessage("Vendor ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
