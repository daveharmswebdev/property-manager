using FluentValidation;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Validator for ResendInvitationCommand.
/// </summary>
public class ResendInvitationCommandValidator : AbstractValidator<ResendInvitationCommand>
{
    public ResendInvitationCommandValidator()
    {
        RuleFor(x => x.InvitationId)
            .NotEmpty().WithMessage("Invitation ID is required");
    }
}
