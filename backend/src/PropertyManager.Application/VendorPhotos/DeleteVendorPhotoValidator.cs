using FluentValidation;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Validator for DeleteVendorPhotoCommand.
/// </summary>
public class DeleteVendorPhotoValidator : AbstractValidator<DeleteVendorPhotoCommand>
{
    public DeleteVendorPhotoValidator()
    {
        RuleFor(x => x.VendorId)
            .NotEmpty().WithMessage("Vendor ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
