using FluentValidation;

namespace PropertyManager.Application.AccountUsers;

/// <summary>
/// Validator for UpdateUserRoleCommand (AC #2).
/// </summary>
public class UpdateUserRoleValidator : AbstractValidator<UpdateUserRoleCommand>
{
    private static readonly string[] ValidRoles = ["Owner", "Contributor"];

    public UpdateUserRoleValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("UserId is required");

        RuleFor(x => x.Role)
            .NotEmpty()
            .WithMessage("Role is required");

        RuleFor(x => x.Role)
            .Must(role => ValidRoles.Contains(role))
            .When(x => !string.IsNullOrEmpty(x.Role))
            .WithMessage("Role must be 'Owner' or 'Contributor'");
    }
}
