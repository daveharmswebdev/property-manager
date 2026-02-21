using FluentValidation;

namespace PropertyManager.Application.Expenses;

public class LinkReceiptToExpenseValidator : AbstractValidator<LinkReceiptToExpenseCommand>
{
    public LinkReceiptToExpenseValidator()
    {
        RuleFor(x => x.ExpenseId).NotEmpty();
        RuleFor(x => x.ReceiptId).NotEmpty();
    }
}
