using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Reports;

/// <summary>
/// Query to download a generated report.
/// </summary>
public record GetReportDownloadQuery(Guid ReportId) : IRequest<ReportDownloadResult>;

/// <summary>
/// Result of downloading a report.
/// </summary>
/// <param name="Content">The file bytes.</param>
/// <param name="ContentType">MIME type of the file.</param>
/// <param name="FileName">Original filename.</param>
public record ReportDownloadResult(byte[] Content, string ContentType, string FileName);

/// <summary>
/// Handler for GetReportDownloadQuery.
/// Retrieves the report file from S3 storage.
/// </summary>
public class GetReportDownloadHandler : IRequestHandler<GetReportDownloadQuery, ReportDownloadResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly IReportStorageService _storageService;
    private readonly ILogger<GetReportDownloadHandler> _logger;

    public GetReportDownloadHandler(
        IAppDbContext dbContext,
        IReportStorageService storageService,
        ILogger<GetReportDownloadHandler> logger)
    {
        _dbContext = dbContext;
        _storageService = storageService;
        _logger = logger;
    }

    public async Task<ReportDownloadResult> Handle(GetReportDownloadQuery request, CancellationToken cancellationToken)
    {
        // Find report - global query filter already applies tenant isolation
        var report = await _dbContext.GeneratedReports
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.ReportId, cancellationToken);

        if (report == null)
        {
            throw new NotFoundException("Report", request.ReportId);
        }

        // Get file content from S3
        var content = await _storageService.GetReportAsync(report.StorageKey, cancellationToken);

        // Determine content type based on report type
        var contentType = report.ReportType == ReportType.Batch
            ? "application/zip"
            : "application/pdf";

        _logger.LogInformation(
            "Downloaded report {ReportId} ({FileName}, {ContentLength} bytes)",
            request.ReportId,
            report.FileName,
            content.Length);

        return new ReportDownloadResult(content, contentType, report.FileName);
    }
}
