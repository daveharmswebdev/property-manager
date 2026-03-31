using FluentValidation;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Validator for ValidateInvitationQuery.
/// </summary>
public class ValidateInvitationQueryValidator : AbstractValidator<ValidateInvitationQuery>
{
    public ValidateInvitationQueryValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Invitation code is required");
    }
}
