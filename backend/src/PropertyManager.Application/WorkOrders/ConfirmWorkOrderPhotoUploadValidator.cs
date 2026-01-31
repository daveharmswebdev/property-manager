using FluentValidation;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for ConfirmWorkOrderPhotoUploadCommand.
/// </summary>
public class ConfirmWorkOrderPhotoUploadValidator : AbstractValidator<ConfirmWorkOrderPhotoUploadCommand>
{
    public ConfirmWorkOrderPhotoUploadValidator()
    {
        RuleFor(x => x.WorkOrderId)
            .NotEmpty().WithMessage("Work order ID is required");

        RuleFor(x => x.StorageKey)
            .NotEmpty().WithMessage("Storage key is required")
            .MaximumLength(500).WithMessage("Storage key must not exceed 500 characters");

        RuleFor(x => x.ThumbnailStorageKey)
            .NotEmpty().WithMessage("Thumbnail storage key is required")
            .MaximumLength(500).WithMessage("Thumbnail storage key must not exceed 500 characters");

        RuleFor(x => x.ContentType)
            .NotEmpty().WithMessage("Content type is required")
            .Must(BeAllowedContentType)
            .WithMessage($"Content type must be one of: {string.Join(", ", PhotoValidation.AllowedContentTypes)}");

        RuleFor(x => x.FileSizeBytes)
            .GreaterThan(0).WithMessage("File size must be greater than 0")
            .LessThanOrEqualTo(PhotoValidation.MaxFileSizeBytes)
            .WithMessage($"File size must not exceed {PhotoValidation.MaxFileSizeBytes / (1024 * 1024)}MB");

        RuleFor(x => x.OriginalFileName)
            .NotEmpty().WithMessage("Original file name is required")
            .MaximumLength(255).WithMessage("File name must not exceed 255 characters");
    }

    private static bool BeAllowedContentType(string contentType)
    {
        if (string.IsNullOrEmpty(contentType))
            return false;

        return PhotoValidation.AllowedContentTypes.Contains(contentType);
    }
}
