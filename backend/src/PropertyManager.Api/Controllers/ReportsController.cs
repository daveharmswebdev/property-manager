using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Reports;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Report generation endpoints for tax documents and summaries.
/// </summary>
[ApiController]
[Route("api/v1/reports")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IScheduleEPdfGenerator _pdfGenerator;
    private readonly IReportBundleService _bundleService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(
        IMediator mediator,
        IScheduleEPdfGenerator pdfGenerator,
        IReportBundleService bundleService,
        ILogger<ReportsController> logger)
    {
        _mediator = mediator;
        _pdfGenerator = pdfGenerator;
        _bundleService = bundleService;
        _logger = logger;
    }

    /// <summary>
    /// Generate a Schedule E PDF report for a property and tax year (AC-6.1.1, AC-6.1.2, AC-6.1.3, AC-6.1.4).
    /// </summary>
    /// <param name="request">Property ID and tax year</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>PDF document binary</returns>
    /// <response code="200">Returns the Schedule E PDF document</response>
    /// <response code="400">If request validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found</response>
    [HttpPost("schedule-e")]
    [Produces("application/pdf")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateScheduleE(
        [FromBody] GenerateScheduleERequest request,
        CancellationToken ct)
    {
        // Validate request
        var errors = new Dictionary<string, string[]>();
        if (request.PropertyId == Guid.Empty)
        {
            errors.Add("propertyId", ["Property ID is required"]);
        }
        if (request.Year < 2000 || request.Year > DateTime.UtcNow.Year + 1)
        {
            errors.Add("year", ["Year must be between 2000 and next year"]);
        }

        if (errors.Count > 0)
        {
            var problemDetails = new ValidationProblemDetails(errors)
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest,
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            };
            return BadRequest(problemDetails);
        }

        // Get report data
        var reportData = await _mediator.Send(
            new GenerateScheduleEReportQuery(request.PropertyId, request.Year), ct);

        // Generate PDF
        var pdfBytes = _pdfGenerator.Generate(reportData);

        // Sanitize property name for filename (AC-6.1.3)
        var sanitizedName = new string(reportData.PropertyName
            .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')
            .ToArray())
            .Replace(' ', '-');

        var filename = $"Schedule-E-{sanitizedName}-{request.Year}.pdf";

        _logger.LogInformation(
            "Generated Schedule E report for property {PropertyId}, year {Year}: Income={TotalIncome}, Expenses={TotalExpenses}, Net={NetIncome} at {Timestamp}",
            request.PropertyId,
            request.Year,
            reportData.TotalIncome,
            reportData.TotalExpenses,
            reportData.NetIncome,
            DateTime.UtcNow);

        return File(pdfBytes, "application/pdf", filename);
    }

    /// <summary>
    /// Generate Schedule E PDF reports for multiple properties as a ZIP bundle (AC-6.2.1, AC-6.2.3, AC-6.2.4, AC-6.2.5).
    /// </summary>
    /// <param name="request">List of property IDs and tax year</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>ZIP file containing PDF documents</returns>
    /// <response code="200">Returns a ZIP file containing Schedule E PDFs</response>
    /// <response code="400">If request validation fails or all reports failed</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost("schedule-e/batch")]
    [Produces("application/zip")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GenerateBatchScheduleE(
        [FromBody] GenerateBatchScheduleERequest request,
        CancellationToken ct)
    {
        // Validate request
        var errors = new Dictionary<string, string[]>();
        if (request.PropertyIds == null || request.PropertyIds.Count == 0)
        {
            errors.Add("propertyIds", ["At least one property ID is required"]);
        }
        if (request.Year < 2000 || request.Year > DateTime.UtcNow.Year + 1)
        {
            errors.Add("year", ["Year must be between 2000 and next year"]);
        }

        if (errors.Count > 0)
        {
            var problemDetails = new ValidationProblemDetails(errors)
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                Title = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest,
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            };
            return BadRequest(problemDetails);
        }

        // Generate batch reports
        var batchResult = await _mediator.Send(
            new GenerateBatchScheduleEReportsQuery(request.PropertyIds, request.Year), ct);

        // Collect successful PDFs for bundling
        var pdfFiles = batchResult.Results
            .Where(r => r.Success && r.PdfBytes != null)
            .Select(r =>
            {
                var sanitizedName = SanitizeFileName(r.PropertyName);
                return ($"Schedule-E-{sanitizedName}-{request.Year}.pdf", r.PdfBytes!);
            })
            .ToList();

        if (pdfFiles.Count == 0)
        {
            var problemDetails = new ProblemDetails
            {
                Type = "https://propertymanager.app/errors/report-generation-failed",
                Title = "No reports generated",
                Detail = "All report generations failed. Please check the property IDs and try again.",
                Status = StatusCodes.Status400BadRequest,
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            };
            return BadRequest(problemDetails);
        }

        // Create ZIP bundle
        var zipBytes = _bundleService.CreateZipBundle(pdfFiles);
        var filename = $"Schedule-E-Reports-{request.Year}.zip";

        _logger.LogInformation(
            "Generated batch Schedule E reports for {SuccessCount}/{TotalCount} properties, year {Year} at {Timestamp}",
            pdfFiles.Count,
            request.PropertyIds.Count,
            request.Year,
            DateTime.UtcNow);

        return File(zipBytes, "application/zip", filename);
    }

    /// <summary>
    /// Sanitizes a property name for use in a filename.
    /// </summary>
    private static string SanitizeFileName(string name)
    {
        return new string(name
            .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')
            .ToArray())
            .Replace(' ', '-');
    }
}

/// <summary>
/// Request model for generating a Schedule E report.
/// </summary>
public record GenerateScheduleERequest(
    Guid PropertyId,
    int Year
);

/// <summary>
/// Request model for generating batch Schedule E reports as a ZIP file.
/// </summary>
public record GenerateBatchScheduleERequest(
    List<Guid> PropertyIds,
    int Year
);
