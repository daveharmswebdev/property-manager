using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Properties;

/// <summary>
/// Query to get a single property by ID for the current user's account.
/// Returns null if property doesn't exist or belongs to different account (AC-2.3.6).
/// </summary>
/// <param name="Id">Property GUID</param>
public record GetPropertyByIdQuery(Guid Id) : IRequest<PropertyDetailDto?>;

/// <summary>
/// Detail DTO for property view page (AC-2.3.2).
/// Extends PropertySummaryDto with createdAt, updatedAt, and recent activity.
/// </summary>
public record PropertyDetailDto(
    Guid Id,
    string Name,
    string Street,
    string City,
    string State,
    string ZipCode,
    decimal ExpenseTotal,
    decimal IncomeTotal,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<ExpenseSummaryDto> RecentExpenses,
    IReadOnlyList<IncomeSummaryDto> RecentIncome
);

/// <summary>
/// Placeholder DTO for recent expenses (implemented in Epic 3).
/// </summary>
public record ExpenseSummaryDto(
    Guid Id,
    string Description,
    decimal Amount,
    DateTime Date
);

/// <summary>
/// Placeholder DTO for recent income (implemented in Epic 4).
/// </summary>
public record IncomeSummaryDto(
    Guid Id,
    string Description,
    decimal Amount,
    DateTime Date
);

/// <summary>
/// Handler for GetPropertyByIdQuery.
/// Returns property details for the current user's account only (AC-2.3.5, AC-2.3.6).
/// </summary>
public class GetPropertyByIdQueryHandler : IRequestHandler<GetPropertyByIdQuery, PropertyDetailDto?>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetPropertyByIdQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<PropertyDetailDto?> Handle(GetPropertyByIdQuery request, CancellationToken cancellationToken)
    {
        var property = await _dbContext.Properties
            .Where(p => p.Id == request.Id && p.AccountId == _currentUser.AccountId && p.DeletedAt == null)
            .Select(p => new PropertyDetailDto(
                p.Id,
                p.Name,
                p.Street,
                p.City,
                p.State,
                p.ZipCode,
                0m, // ExpenseTotal placeholder until Epic 3
                0m, // IncomeTotal placeholder until Epic 4
                p.CreatedAt,
                p.UpdatedAt,
                Array.Empty<ExpenseSummaryDto>(), // RecentExpenses placeholder until Epic 3
                Array.Empty<IncomeSummaryDto>()   // RecentIncome placeholder until Epic 4
            ))
            .FirstOrDefaultAsync(cancellationToken);

        return property;
    }
}
