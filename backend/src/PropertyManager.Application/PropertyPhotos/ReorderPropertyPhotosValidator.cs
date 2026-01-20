using FluentValidation;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Validator for ReorderPropertyPhotosCommand.
/// </summary>
public class ReorderPropertyPhotosValidator : AbstractValidator<ReorderPropertyPhotosCommand>
{
    public ReorderPropertyPhotosValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Property ID is required");

        RuleFor(x => x.PhotoIds)
            .NotNull().WithMessage("Photo IDs are required")
            .NotEmpty().WithMessage("Photo IDs cannot be empty");

        RuleForEach(x => x.PhotoIds)
            .NotEmpty().WithMessage("Photo ID cannot be empty");
    }
}
