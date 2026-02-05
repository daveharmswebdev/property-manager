using System.Text.RegularExpressions;
using FluentValidation;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Validator for ProcessReceiptCommand (AC-5.4.4).
/// Applies same validation rules as expense creation.
/// </summary>
public partial class ProcessReceiptValidator : AbstractValidator<ProcessReceiptCommand>
{
    public ProcessReceiptValidator()
    {
        RuleFor(x => x.ReceiptId)
            .NotEmpty().WithMessage("Receipt ID is required");

        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Property is required");

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Category is required");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than $0")
            .LessThanOrEqualTo(9999999.99m).WithMessage("Amount exceeds maximum of $9,999,999.99")
            .PrecisionScale(10, 2, true).WithMessage("Amount can have at most 2 decimal places");

        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("Date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("Date cannot be in the future");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be 500 characters or less")
            .Must(NotContainHtml).WithMessage("Description cannot contain HTML");

        RuleFor(x => x.WorkOrderId)
            .Must(id => id == null || id != Guid.Empty)
            .WithMessage("WorkOrderId must be a valid GUID or null");
    }

    private static bool NotContainHtml(string? description)
    {
        if (string.IsNullOrEmpty(description))
            return true;

        return !HtmlTagRegex().IsMatch(description);
    }

    [GeneratedRegex(@"<[^>]+>", RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();
}
