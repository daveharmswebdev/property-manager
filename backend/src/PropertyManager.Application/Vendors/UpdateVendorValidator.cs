using FluentValidation;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Validator for UpdateVendorCommand (AC #13).
/// </summary>
public class UpdateVendorValidator : AbstractValidator<UpdateVendorCommand>
{
    public UpdateVendorValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Vendor ID is required");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name must be 100 characters or less");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name must be 100 characters or less");

        RuleFor(x => x.MiddleName)
            .MaximumLength(100).WithMessage("Middle name must be 100 characters or less")
            .When(x => x.MiddleName != null);

        RuleForEach(x => x.Phones).ChildRules(phone =>
        {
            phone.RuleFor(p => p.Number)
                .NotEmpty().WithMessage("Phone number is required")
                .MaximumLength(50).WithMessage("Phone number must be 50 characters or less");

            phone.RuleFor(p => p.Label)
                .MaximumLength(50).WithMessage("Phone label must be 50 characters or less")
                .When(p => p.Label != null);
        });

        RuleForEach(x => x.Emails).ChildRules(email =>
        {
            email.RuleFor(e => e)
                .NotEmpty().WithMessage("Email address is required")
                .MaximumLength(255).WithMessage("Email must be 255 characters or less")
                .EmailAddress().WithMessage("Invalid email address format");
        });
    }
}
