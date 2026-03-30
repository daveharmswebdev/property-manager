using FluentValidation;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Validator for ReorderVendorPhotosCommand.
/// </summary>
public class ReorderVendorPhotosValidator : AbstractValidator<ReorderVendorPhotosCommand>
{
    public ReorderVendorPhotosValidator()
    {
        RuleFor(x => x.VendorId)
            .NotEmpty().WithMessage("Vendor ID is required");

        RuleFor(x => x.PhotoIds)
            .NotNull().WithMessage("Photo IDs are required")
            .NotEmpty().WithMessage("Photo IDs cannot be empty");

        RuleForEach(x => x.PhotoIds)
            .NotEmpty().WithMessage("Photo ID cannot be empty");
    }
}
