using FluentValidation;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// Validator for AcceptInvitationCommand.
/// </summary>
public class AcceptInvitationCommandValidator : AbstractValidator<AcceptInvitationCommand>
{
    public AcceptInvitationCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Invitation code is required");

        // Password requirements matching Register.cs (AC3.2)
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters")
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter")
            .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter")
            .Matches("[0-9]").WithMessage("Password must contain at least one number")
            .Matches(@"[!@#$%^&*()_+\-=\[\]{}|;':"",./<>?]").WithMessage("Password must contain at least one special character");
    }
}
