using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Reports;

/// <summary>
/// Query to generate Schedule E reports for multiple properties in a single request.
/// </summary>
public record GenerateBatchScheduleEReportsQuery(
    List<Guid> PropertyIds,
    int Year
) : IRequest<BatchScheduleEReportDto>;

/// <summary>
/// Response containing batch generation results for all requested properties.
/// </summary>
/// <param name="Year">Tax year for the reports.</param>
/// <param name="Results">Individual results for each property.</param>
/// <param name="GeneratedAt">Timestamp when the batch was generated.</param>
public record BatchScheduleEReportDto(
    int Year,
    List<PropertyReportResult> Results,
    DateTime GeneratedAt
);

/// <summary>
/// Result for a single property's report generation.
/// </summary>
/// <param name="PropertyId">Property identifier.</param>
/// <param name="PropertyName">Property display name.</param>
/// <param name="HasData">Whether the property has income or expense data for the year.</param>
/// <param name="Success">Whether the report was generated successfully.</param>
/// <param name="ErrorMessage">Error message if generation failed.</param>
/// <param name="PdfBytes">Generated PDF bytes, null if failed.</param>
public record PropertyReportResult(
    Guid PropertyId,
    string PropertyName,
    bool HasData,
    bool Success,
    string? ErrorMessage,
    byte[]? PdfBytes
);

/// <summary>
/// Handler for GenerateBatchScheduleEReportsQuery.
/// Generates Schedule E reports for multiple properties in parallel.
/// </summary>
public class GenerateBatchScheduleEReportsHandler
    : IRequestHandler<GenerateBatchScheduleEReportsQuery, BatchScheduleEReportDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IMediator _mediator;
    private readonly IScheduleEPdfGenerator _pdfGenerator;

    public GenerateBatchScheduleEReportsHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IMediator mediator,
        IScheduleEPdfGenerator pdfGenerator)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _mediator = mediator;
        _pdfGenerator = pdfGenerator;
    }

    public async Task<BatchScheduleEReportDto> Handle(
        GenerateBatchScheduleEReportsQuery request,
        CancellationToken ct)
    {
        if (request.PropertyIds == null || request.PropertyIds.Count == 0)
        {
            throw new ValidationException("At least one property ID is required");
        }

        // Validate all properties belong to user's account
        var properties = await _dbContext.Properties
            .Where(p => request.PropertyIds.Contains(p.Id)
                     && p.AccountId == _currentUser.AccountId)
            .Select(p => new { p.Id, p.Name })
            .AsNoTracking()
            .ToListAsync(ct);

        if (properties.Count != request.PropertyIds.Count)
        {
            throw new ValidationException("One or more properties not found or do not belong to your account");
        }

        // Generate reports sequentially to avoid DbContext thread-safety issues
        // (DbContext is not thread-safe - parallel MediatR calls would share the same scoped DbContext)
        var results = new List<PropertyReportResult>();
        foreach (var property in properties)
        {
            try
            {
                var reportData = await _mediator.Send(
                    new GenerateScheduleEReportQuery(property.Id, request.Year), ct);

                var pdfBytes = _pdfGenerator.Generate(reportData);
                var hasData = reportData.TotalIncome > 0 || reportData.TotalExpenses > 0;

                results.Add(new PropertyReportResult(
                    property.Id,
                    property.Name,
                    hasData,
                    true,
                    null,
                    pdfBytes
                ));
            }
            catch (Exception ex)
            {
                results.Add(new PropertyReportResult(
                    property.Id,
                    property.Name,
                    false,
                    false,
                    ex.Message,
                    null
                ));
            }
        }

        return new BatchScheduleEReportDto(
            request.Year,
            results,
            DateTime.UtcNow
        );
    }
}
