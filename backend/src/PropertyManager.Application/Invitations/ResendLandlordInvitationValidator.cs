using FluentValidation;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Validator for ResendLandlordInvitationCommand (Story 22.4).
/// </summary>
public class ResendLandlordInvitationCommandValidator : AbstractValidator<ResendLandlordInvitationCommand>
{
    public ResendLandlordInvitationCommandValidator()
    {
        RuleFor(x => x.InvitationId)
            .NotEmpty().WithMessage("Invitation ID is required");
    }
}
