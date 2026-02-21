using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;
using IncomeEntity = PropertyManager.Domain.Entities.Income;

namespace PropertyManager.Application.Income;

/// <summary>
/// Command for updating an existing income entry (AC-4.2.2, AC-4.2.3, AC-4.2.4, AC-16.2.4).
/// PropertyId is optional — when provided, reassigns the income to the new property.
/// </summary>
public record UpdateIncomeCommand(
    Guid Id,
    decimal Amount,
    DateOnly Date,
    string? Source,
    string? Description,
    Guid? PropertyId = null
) : IRequest;

/// <summary>
/// Validator for UpdateIncomeCommand (AC-4.2.4).
/// Validates Amount > 0, Date required.
/// </summary>
public class UpdateIncomeValidator : AbstractValidator<UpdateIncomeCommand>
{
    public UpdateIncomeValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Income ID is required.");

        RuleFor(x => x.Amount)
            .GreaterThan(0)
            .WithMessage("Amount must be greater than $0");

        RuleFor(x => x.Date)
            .NotEmpty()
            .WithMessage("Date is required.");

        RuleFor(x => x.PropertyId)
            .Must(id => id == null || id != Guid.Empty)
            .WithMessage("Property ID must be a valid GUID when provided.");
    }
}

/// <summary>
/// Handler for UpdateIncomeCommand.
/// Updates an existing income entry with AccountId validation.
/// Preserves CreatedAt, CreatedByUserId, PropertyId.
/// Sets UpdatedAt to current UTC time (AC-4.2.3).
/// </summary>
public class UpdateIncomeCommandHandler : IRequestHandler<UpdateIncomeCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public UpdateIncomeCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateIncomeCommand request, CancellationToken cancellationToken)
    {
        // Find income - AccountId filtering handled by global query filter
        var income = await _dbContext.Income
            .Where(i => i.Id == request.Id && i.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (income == null)
        {
            throw new NotFoundException(nameof(IncomeEntity), request.Id);
        }

        // Handle property reassignment (AC-16.2.4)
        if (request.PropertyId.HasValue && request.PropertyId.Value != income.PropertyId)
        {
            var newProperty = await _dbContext.Properties
                .Where(p => p.Id == request.PropertyId.Value && p.DeletedAt == null)
                .Select(p => new { p.Id, p.AccountId })
                .FirstOrDefaultAsync(cancellationToken);

            if (newProperty == null || newProperty.AccountId != _currentUser.AccountId)
                throw new NotFoundException(nameof(Property), request.PropertyId.Value);

            income.PropertyId = request.PropertyId.Value;
        }

        // Update editable fields only (AC-4.2.2)
        income.Amount = request.Amount;
        income.Date = request.Date;
        income.Source = request.Source?.Trim();
        income.Description = request.Description?.Trim();

        // Set UpdatedAt timestamp (AC-4.2.3)
        income.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
