using FluentValidation;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Validator for CreateVendorCommand (AC #8).
/// </summary>
public class CreateVendorValidator : AbstractValidator<CreateVendorCommand>
{
    public CreateVendorValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name must be 100 characters or less");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name must be 100 characters or less");

        RuleFor(x => x.MiddleName)
            .MaximumLength(100).WithMessage("Middle name must be 100 characters or less")
            .When(x => x.MiddleName != null);
    }
}
