using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Properties;

/// <summary>
/// Query to get a single property by ID for the current user's account.
/// Returns null if property doesn't exist or belongs to different account (AC-2.3.6).
/// </summary>
/// <param name="Id">Property GUID</param>
/// <param name="Year">Optional tax year filter (defaults to current year) (AC-3.5.6)</param>
public record GetPropertyByIdQuery(Guid Id, int? Year = null) : IRequest<PropertyDetailDto?>;

/// <summary>
/// Detail DTO for property view page (AC-2.3.2, AC-13.3a.9).
/// Extends PropertySummaryDto with createdAt, updatedAt, recent activity, and primary photo.
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
    IReadOnlyList<IncomeSummaryDto> RecentIncome,
    string? PrimaryPhotoThumbnailUrl = null
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
/// Returns property details for the current user's account only (AC-2.3.5, AC-2.3.6, AC-13.3a.9).
/// </summary>
public class GetPropertyByIdQueryHandler : IRequestHandler<GetPropertyByIdQuery, PropertyDetailDto?>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IPhotoService _photoService;

    public GetPropertyByIdQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IPhotoService photoService)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _photoService = photoService;
    }

    public async Task<PropertyDetailDto?> Handle(GetPropertyByIdQuery request, CancellationToken cancellationToken)
    {
        // Use provided year or default to current year (AC-3.5.6)
        var year = request.Year ?? DateTime.UtcNow.Year;
        var yearStart = new DateOnly(year, 1, 1);
        var yearEnd = new DateOnly(year, 12, 31);

        var propertyData = await _dbContext.Properties
            .Where(p => p.Id == request.Id && p.AccountId == _currentUser.AccountId && p.DeletedAt == null)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Street,
                p.City,
                p.State,
                p.ZipCode,
                ExpenseTotal = _dbContext.Expenses
                    .Where(e => e.PropertyId == p.Id
                        && e.AccountId == _currentUser.AccountId
                        && e.DeletedAt == null
                        && e.Date >= yearStart && e.Date <= yearEnd)
                    .Sum(e => (decimal?)e.Amount) ?? 0m,
                IncomeTotal = _dbContext.Income
                    .Where(i => i.PropertyId == p.Id
                        && i.AccountId == _currentUser.AccountId
                        && i.DeletedAt == null
                        && i.Date >= yearStart && i.Date <= yearEnd)
                    .Sum(i => (decimal?)i.Amount) ?? 0m,
                p.CreatedAt,
                p.UpdatedAt,
                RecentExpenses = _dbContext.Expenses
                    .Where(e => e.PropertyId == p.Id
                        && e.AccountId == _currentUser.AccountId
                        && e.DeletedAt == null
                        && e.Date >= yearStart && e.Date <= yearEnd)
                    .OrderByDescending(e => e.Date)
                    .ThenByDescending(e => e.CreatedAt)
                    .ThenByDescending(e => e.Id)
                    .Take(5)
                    .Select(e => new ExpenseSummaryDto(
                        e.Id,
                        e.Description ?? string.Empty,
                        e.Amount,
                        new DateTime(e.Date.Year, e.Date.Month, e.Date.Day)
                    ))
                    .ToList(),
                RecentIncome = _dbContext.Income
                    .Where(i => i.PropertyId == p.Id
                        && i.AccountId == _currentUser.AccountId
                        && i.DeletedAt == null
                        && i.Date >= yearStart && i.Date <= yearEnd)
                    .OrderByDescending(i => i.Date)
                    .ThenByDescending(i => i.CreatedAt)
                    .ThenByDescending(i => i.Id)
                    .Take(5)
                    .Select(i => new IncomeSummaryDto(
                        i.Id,
                        i.Description ?? string.Empty,
                        i.Amount,
                        new DateTime(i.Date.Year, i.Date.Month, i.Date.Day)
                    ))
                    .ToList(),
                PrimaryPhotoThumbnailStorageKey = _dbContext.PropertyPhotos
                    .Where(pp => pp.PropertyId == p.Id && pp.IsPrimary)
                    .Select(pp => pp.ThumbnailStorageKey)
                    .FirstOrDefault()
            })
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (propertyData == null)
        {
            return null;
        }

        // Generate presigned URL for primary photo thumbnail (AC-13.3a.9)
        string? primaryPhotoThumbnailUrl = null;
        if (!string.IsNullOrEmpty(propertyData.PrimaryPhotoThumbnailStorageKey))
        {
            primaryPhotoThumbnailUrl = await _photoService.GetThumbnailUrlAsync(
                propertyData.PrimaryPhotoThumbnailStorageKey, cancellationToken);
        }

        return new PropertyDetailDto(
            propertyData.Id,
            propertyData.Name,
            propertyData.Street,
            propertyData.City,
            propertyData.State,
            propertyData.ZipCode,
            propertyData.ExpenseTotal,
            propertyData.IncomeTotal,
            propertyData.CreatedAt,
            propertyData.UpdatedAt,
            propertyData.RecentExpenses,
            propertyData.RecentIncome,
            primaryPhotoThumbnailUrl
        );
    }
}
