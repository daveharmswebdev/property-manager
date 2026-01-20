using FluentValidation;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Validator for SetPrimaryPropertyPhotoCommand.
/// </summary>
public class SetPrimaryPropertyPhotoValidator : AbstractValidator<SetPrimaryPropertyPhotoCommand>
{
    public SetPrimaryPropertyPhotoValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Property ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
