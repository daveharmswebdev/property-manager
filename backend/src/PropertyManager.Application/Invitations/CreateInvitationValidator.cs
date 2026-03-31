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
            .Must(r => r == "Owner" || r == "Contributor")
            .WithMessage("Role must be 'Owner' or 'Contributor'");
    }
}
