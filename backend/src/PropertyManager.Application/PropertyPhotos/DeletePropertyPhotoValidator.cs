using FluentValidation;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Validator for DeletePropertyPhotoCommand.
/// </summary>
public class DeletePropertyPhotoValidator : AbstractValidator<DeletePropertyPhotoCommand>
{
    public DeletePropertyPhotoValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Property ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
