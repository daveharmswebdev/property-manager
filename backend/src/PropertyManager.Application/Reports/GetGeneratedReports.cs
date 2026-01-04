using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Reports;

/// <summary>
/// Query to get all generated reports for the current user's account.
/// </summary>
public record GetGeneratedReportsQuery : IRequest<List<GeneratedReportDto>>;

/// <summary>
/// DTO for generated report list response.
/// </summary>
/// <param name="Id">Report ID.</param>
/// <param name="DisplayName">Property name or "All Properties" for batch reports.</param>
/// <param name="Year">Tax year.</param>
/// <param name="GeneratedAt">When the report was generated.</param>
/// <param name="FileName">Original filename.</param>
/// <param name="FileType">PDF or ZIP.</param>
/// <param name="FileSizeBytes">File size in bytes.</param>
public record GeneratedReportDto(
    Guid Id,
    string DisplayName,
    int Year,
    DateTime GeneratedAt,
    string FileName,
    string FileType,
    long FileSizeBytes
);

/// <summary>
/// Handler for GetGeneratedReportsQuery.
/// Returns all generated reports for the current user's account, sorted by date descending.
/// </summary>
public class GetGeneratedReportsHandler : IRequestHandler<GetGeneratedReportsQuery, List<GeneratedReportDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetGeneratedReportsHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<List<GeneratedReportDto>> Handle(GetGeneratedReportsQuery request, CancellationToken cancellationToken)
    {
        var reports = await _dbContext.GeneratedReports
            .Where(r => r.AccountId == _currentUser.AccountId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new GeneratedReportDto(
                r.Id,
                r.ReportType == ReportType.Batch
                    ? "All Properties"
                    : r.PropertyName ?? "Unknown Property",
                r.Year,
                r.CreatedAt,
                r.FileName,
                r.ReportType == ReportType.Batch ? "ZIP" : "PDF",
                r.FileSizeBytes
            ))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return reports;
    }
}
