using System.Text.RegularExpressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Reports;

/// <summary>
/// Query to generate a Schedule E report for a specific property and tax year.
/// </summary>
public record GenerateScheduleEReportQuery(Guid PropertyId, int Year) : IRequest<ScheduleEReportDto>;

/// <summary>
/// Handler for GenerateScheduleEReportQuery.
/// Aggregates income and expenses by category for the specified property and year.
/// </summary>
public class GenerateScheduleEReportHandler : IRequestHandler<GenerateScheduleEReportQuery, ScheduleEReportDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GenerateScheduleEReportHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<ScheduleEReportDto> Handle(GenerateScheduleEReportQuery request, CancellationToken cancellationToken)
    {
        // Verify property exists and belongs to current user's account
        var property = await _dbContext.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId, cancellationToken)
            ?? throw new NotFoundException("Property", request.PropertyId);

        var startDate = new DateOnly(request.Year, 1, 1);
        var endDate = new DateOnly(request.Year, 12, 31);

        // Get expenses grouped by category with Schedule E line info
        var expensesByCategory = await _dbContext.Expenses
            .Include(e => e.Category)
            .Where(e => e.PropertyId == request.PropertyId
                     && e.Date >= startDate
                     && e.Date <= endDate)
            .GroupBy(e => new { e.Category.Id, e.Category.Name, e.Category.ScheduleELine, e.Category.SortOrder })
            .Select(g => new
            {
                CategoryName = g.Key.Name,
                ScheduleELine = g.Key.ScheduleELine,
                SortOrder = g.Key.SortOrder,
                Amount = g.Sum(e => e.Amount)
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Convert to DTO with parsed line numbers
        var lineItems = expensesByCategory
            .Select(e => new ScheduleELineItemDto(
                ParseLineNumber(e.ScheduleELine),
                e.CategoryName,
                e.Amount
            ))
            .OrderBy(e => e.LineNumber)
            .ToList();

        // Get total income for the year
        var totalIncome = await _dbContext.Income
            .Where(i => i.PropertyId == request.PropertyId
                     && i.Date >= startDate
                     && i.Date <= endDate)
            .SumAsync(i => i.Amount, cancellationToken);

        var totalExpenses = lineItems.Sum(e => e.Amount);

        // Compose full address from property fields
        var propertyAddress = FormatAddress(property.Street, property.City, property.State, property.ZipCode);

        return new ScheduleEReportDto(
            PropertyId: property.Id,
            PropertyName: property.Name,
            PropertyAddress: propertyAddress,
            TaxYear: request.Year,
            TotalIncome: totalIncome,
            ExpensesByCategory: lineItems,
            TotalExpenses: totalExpenses,
            NetIncome: totalIncome - totalExpenses,
            GeneratedAt: DateTime.UtcNow
        );
    }

    /// <summary>
    /// Parses the Schedule E line number from the string format "Line X".
    /// Returns 19 (Other) if parsing fails.
    /// </summary>
    private static int ParseLineNumber(string? scheduleELine)
    {
        if (string.IsNullOrEmpty(scheduleELine))
            return 19; // Default to "Other" line

        // Use Regex to find the first number in the string
        // Handles formats like "Line 5", "Line 5 ", "5", "Line  5"
        var match = Regex.Match(scheduleELine, @"\d+");
        
        if (match.Success && int.TryParse(match.Value, out var lineNumber))
            return lineNumber;

        return 19; // Default to "Other" if parsing fails
    }

    /// <summary>
    /// Formats the property address from individual components.
    /// </summary>
    private static string FormatAddress(string street, string city, string state, string zipCode)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(street))
            parts.Add(street);

        var cityStateZip = new List<string>();
        if (!string.IsNullOrWhiteSpace(city))
            cityStateZip.Add(city);
        if (!string.IsNullOrWhiteSpace(state))
            cityStateZip.Add(state);
        if (!string.IsNullOrWhiteSpace(zipCode))
            cityStateZip.Add(zipCode);

        if (cityStateZip.Count > 0)
            parts.Add(string.Join(", ", cityStateZip));

        return string.Join(", ", parts);
    }
}
