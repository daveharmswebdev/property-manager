using FluentValidation;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Validator for GetWorkOrderExpensesQuery (AC #6).
/// </summary>
public class GetWorkOrderExpensesValidator : AbstractValidator<GetWorkOrderExpensesQuery>
{
    public GetWorkOrderExpensesValidator()
    {
        RuleFor(x => x.WorkOrderId).NotEmpty();
    }
}
