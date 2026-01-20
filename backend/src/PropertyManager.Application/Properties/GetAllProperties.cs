using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Properties;

/// <summary>
/// Query to get all properties for the current user's account.
/// </summary>
/// <param name="Year">Optional tax year filter for expense/income totals (defaults to current year)</param>
public record GetAllPropertiesQuery(int? Year = null) : IRequest<GetAllPropertiesResponse>;

/// <summary>
/// Response containing list of properties.
/// </summary>
public record GetAllPropertiesResponse(
    IReadOnlyList<PropertySummaryDto> Items,
    int TotalCount
);

/// <summary>
/// Summary DTO for property list display (AC-2.1.4, AC-13.3a.9).
/// </summary>
public record PropertySummaryDto(
    Guid Id,
    string Name,
    string Street,
    string City,
    string State,
    string ZipCode,
    decimal ExpenseTotal,
    decimal IncomeTotal,
    string? PrimaryPhotoThumbnailUrl = null
);

/// <summary>
/// Handler for GetAllPropertiesQuery.
/// Returns all properties for the current user's account.
/// </summary>
public class GetAllPropertiesQueryHandler : IRequestHandler<GetAllPropertiesQuery, GetAllPropertiesResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IPhotoService _photoService;

    public GetAllPropertiesQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IPhotoService photoService)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _photoService = photoService;
    }

    public async Task<GetAllPropertiesResponse> Handle(GetAllPropertiesQuery request, CancellationToken cancellationToken)
    {
        var year = request.Year ?? DateTime.UtcNow.Year;

        // Query properties with primary photo thumbnail storage key
        var propertiesData = await _dbContext.Properties
            .Where(p => p.AccountId == _currentUser.AccountId && p.DeletedAt == null)
            .OrderBy(p => p.Name)
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
                        && e.Date.Year == year)
                    .Sum(e => (decimal?)e.Amount) ?? 0m,
                IncomeTotal = _dbContext.Income
                    .Where(i => i.PropertyId == p.Id
                        && i.AccountId == _currentUser.AccountId
                        && i.DeletedAt == null
                        && i.Date.Year == year)
                    .Sum(i => (decimal?)i.Amount) ?? 0m,
                PrimaryPhotoThumbnailStorageKey = _dbContext.PropertyPhotos
                    .Where(pp => pp.PropertyId == p.Id && pp.IsPrimary)
                    .Select(pp => pp.ThumbnailStorageKey)
                    .FirstOrDefault()
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Generate presigned URLs for primary photo thumbnails (AC-13.3a.9)
        var properties = new List<PropertySummaryDto>();
        foreach (var p in propertiesData)
        {
            string? primaryPhotoThumbnailUrl = null;
            if (!string.IsNullOrEmpty(p.PrimaryPhotoThumbnailStorageKey))
            {
                primaryPhotoThumbnailUrl = await _photoService.GetThumbnailUrlAsync(
                    p.PrimaryPhotoThumbnailStorageKey, cancellationToken);
            }

            properties.Add(new PropertySummaryDto(
                p.Id,
                p.Name,
                p.Street,
                p.City,
                p.State,
                p.ZipCode,
                p.ExpenseTotal,
                p.IncomeTotal,
                primaryPhotoThumbnailUrl
            ));
        }

        return new GetAllPropertiesResponse(properties, properties.Count);
    }
}
