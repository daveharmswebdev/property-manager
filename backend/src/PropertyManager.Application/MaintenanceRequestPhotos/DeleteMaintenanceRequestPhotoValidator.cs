using FluentValidation;

namespace PropertyManager.Application.MaintenanceRequestPhotos;

/// <summary>
/// Validator for DeleteMaintenanceRequestPhotoCommand.
/// </summary>
public class DeleteMaintenanceRequestPhotoValidator : AbstractValidator<DeleteMaintenanceRequestPhotoCommand>
{
    public DeleteMaintenanceRequestPhotoValidator()
    {
        RuleFor(x => x.MaintenanceRequestId)
            .NotEmpty().WithMessage("Maintenance request ID is required");

        RuleFor(x => x.PhotoId)
            .NotEmpty().WithMessage("Photo ID is required");
    }
}
