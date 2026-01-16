using FluentValidation;

namespace PropertyManager.Application.VendorTradeTags;

/// <summary>
/// Validator for CreateVendorTradeTagCommand (AC #4).
/// </summary>
public class CreateVendorTradeTagValidator : AbstractValidator<CreateVendorTradeTagCommand>
{
    public CreateVendorTradeTagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(100).WithMessage("Name must be 100 characters or less");
    }
}
