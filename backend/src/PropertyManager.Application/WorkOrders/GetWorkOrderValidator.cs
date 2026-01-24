using FluentValidation;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for GetWorkOrderQuery.
/// Validates that the work order ID is a valid non-empty GUID.
/// </summary>
public class GetWorkOrderValidator : AbstractValidator<GetWorkOrderQuery>
{
    public GetWorkOrderValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Work order ID is required");
    }
}
