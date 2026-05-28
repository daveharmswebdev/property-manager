using FluentValidation;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Validator for <see cref="CreateLandlordInvitationCommand"/> (AC: 22.2 #7).
/// Minimal — the only required field is Email; no Role / AccountId / PropertyId on the DTO.
/// </summary>
public class CreateLandlordInvitationCommandValidator : AbstractValidator<CreateLandlordInvitationCommand>
{
    public CreateLandlordInvitationCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");
    }
}
