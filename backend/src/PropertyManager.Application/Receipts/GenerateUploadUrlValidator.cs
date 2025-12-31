using FluentValidation;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Validator for GenerateUploadUrlCommand (AC-5.1.6).
/// Validates content type and file size before generating upload URL.
/// </summary>
public class GenerateUploadUrlValidator : AbstractValidator<GenerateUploadUrlCommand>
{
    /// <summary>
    /// Allowed content types for receipt uploads.
    /// </summary>
    public static readonly string[] AllowedContentTypes =
    [
        "image/jpeg",
        "image/png",
        "application/pdf"
    ];

    /// <summary>
    /// Maximum file size in bytes (10MB).
    /// </summary>
    public const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10MB

    public GenerateUploadUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty().WithMessage("Content type is required")
            .Must(BeAllowedContentType)
            .WithMessage($"Content type must be one of: {string.Join(", ", AllowedContentTypes)}");

        RuleFor(x => x.FileSizeBytes)
            .GreaterThan(0).WithMessage("File size must be greater than 0")
            .LessThanOrEqualTo(MaxFileSizeBytes)
            .WithMessage($"File size must not exceed {MaxFileSizeBytes / (1024 * 1024)}MB");
    }

    private static bool BeAllowedContentType(string contentType)
    {
        if (string.IsNullOrEmpty(contentType))
            return false;

        return AllowedContentTypes.Contains(contentType.ToLowerInvariant());
    }
}
