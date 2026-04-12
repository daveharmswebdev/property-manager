using FluentValidation;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Validator for CreateInvitationCommand.
/// </summary>
public class CreateInvitationCommandValidator : AbstractValidator<CreateInvitationCommand>
{
    public CreateInvitationCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Role is required")
            .Must(r => r == "Owner" || r == "Contributor" || r == "Tenant")
            .WithMessage("Role must be 'Owner', 'Contributor', or 'Tenant'");

        When(x => x.Role == "Tenant", () =>
        {
            RuleFor(x => x.PropertyId)
                .NotNull().WithMessage("PropertyId is required for Tenant invitations");
        });

        When(x => x.Role != "Tenant", () =>
        {
            RuleFor(x => x.PropertyId)
                .Null().WithMessage("PropertyId should only be set for Tenant invitations");
        });
    }
}
