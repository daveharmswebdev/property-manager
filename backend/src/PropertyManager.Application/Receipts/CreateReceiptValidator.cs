using FluentValidation;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Validator for CreateReceiptCommand (AC-5.1.3, AC-5.1.6).
/// </summary>
public class CreateReceiptValidator : AbstractValidator<CreateReceiptCommand>
{
    public CreateReceiptValidator()
    {
        RuleFor(x => x.StorageKey)
            .NotEmpty().WithMessage("Storage key is required")
            .MaximumLength(500).WithMessage("Storage key must be 500 characters or less");

        RuleFor(x => x.OriginalFileName)
            .NotEmpty().WithMessage("Original file name is required")
            .MaximumLength(255).WithMessage("Original file name must be 255 characters or less");

        RuleFor(x => x.ContentType)
            .NotEmpty().WithMessage("Content type is required")
            .Must(BeAllowedContentType)
            .WithMessage($"Content type must be one of: {string.Join(", ", GenerateUploadUrlValidator.AllowedContentTypes)}");

        RuleFor(x => x.FileSizeBytes)
            .GreaterThan(0).WithMessage("File size must be greater than 0")
            .LessThanOrEqualTo(GenerateUploadUrlValidator.MaxFileSizeBytes)
            .WithMessage($"File size must not exceed {GenerateUploadUrlValidator.MaxFileSizeBytes / (1024 * 1024)}MB");
    }

    private static bool BeAllowedContentType(string contentType)
    {
        if (string.IsNullOrEmpty(contentType))
            return false;

        return GenerateUploadUrlValidator.AllowedContentTypes.Contains(contentType.ToLowerInvariant());
    }
}
