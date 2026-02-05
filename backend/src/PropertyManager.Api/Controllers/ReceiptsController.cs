using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Common;
using PropertyManager.Application.Receipts;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Receipt management endpoints for S3 presigned URL uploads.
/// </summary>
[ApiController]
[Route("api/v1/receipts")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ReceiptsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GenerateUploadUrlCommand> _uploadUrlValidator;
    private readonly IValidator<CreateReceiptCommand> _createValidator;
    private readonly IValidator<ProcessReceiptCommand> _processValidator;
    private readonly ILogger<ReceiptsController> _logger;

    public ReceiptsController(
        IMediator mediator,
        IValidator<GenerateUploadUrlCommand> uploadUrlValidator,
        IValidator<CreateReceiptCommand> createValidator,
        IValidator<ProcessReceiptCommand> processValidator,
        ILogger<ReceiptsController> logger)
    {
        _mediator = mediator;
        _uploadUrlValidator = uploadUrlValidator;
        _createValidator = createValidator;
        _processValidator = processValidator;
        _logger = logger;
    }

    /// <summary>
    /// Generate a presigned S3 upload URL (AC-5.1.1, AC-5.1.6).
    /// </summary>
    /// <param name="request">Content type and file size</param>
    /// <returns>Presigned upload URL details</returns>
    /// <response code="200">Returns presigned upload URL</response>
    /// <response code="400">If validation fails (invalid content type or file size)</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost("upload-url")]
    [ProducesResponseType(typeof(UploadUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GenerateUploadUrl([FromBody] GenerateUploadUrlRequest request)
    {
        var command = new GenerateUploadUrlCommand(
            request.ContentType,
            request.FileSizeBytes,
            request.PropertyId);

        // Validate command
        var validationResult = await _uploadUrlValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var response = await _mediator.Send(command);

        _logger.LogInformation(
            "Generated presigned upload URL: StorageKey={StorageKey}, ExpiresAt={ExpiresAt} at {Timestamp}",
            response.StorageKey,
            response.ExpiresAt,
            DateTime.UtcNow);

        return Ok(response);
    }

    /// <summary>
    /// Confirm S3 upload and create receipt record (AC-5.1.3).
    /// </summary>
    /// <param name="request">Receipt details after S3 upload</param>
    /// <returns>The newly created receipt's ID</returns>
    /// <response code="201">Returns the newly created receipt ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found (when PropertyId provided)</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateReceiptResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateReceipt([FromBody] CreateReceiptRequest request)
    {
        var command = new CreateReceiptCommand(
            request.StorageKey,
            request.OriginalFileName,
            request.ContentType,
            request.FileSizeBytes,
            request.PropertyId);

        // Validate command
        var validationResult = await _createValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var receiptId = await _mediator.Send(command);

        _logger.LogInformation(
            "Receipt created: {ReceiptId} for StorageKey={StorageKey} at {Timestamp}",
            receiptId,
            LogSanitizer.Sanitize(request.StorageKey),
            DateTime.UtcNow);

        var response = new CreateReceiptResponse(receiptId);

        return CreatedAtAction(
            nameof(GetReceipt),
            new { id = receiptId },
            response);
    }

    /// <summary>
    /// Get a receipt by ID with presigned view URL (AC-5.1.4).
    /// </summary>
    /// <param name="id">Receipt GUID</param>
    /// <returns>Receipt details with presigned view URL</returns>
    /// <response code="200">Returns the receipt</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If receipt not found</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ReceiptDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReceipt(Guid id)
    {
        var query = new GetReceiptQuery(id);
        var receipt = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved receipt {ReceiptId} at {Timestamp}",
            id,
            DateTime.UtcNow);

        return Ok(receipt);
    }

    /// <summary>
    /// Get all unprocessed receipts for the current account (AC-5.3.2, AC-5.3.4).
    /// Returns receipts where ProcessedAt IS NULL, sorted by CreatedAt descending.
    /// </summary>
    /// <returns>List of unprocessed receipts with presigned view URLs</returns>
    /// <response code="200">Returns list of unprocessed receipts</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet("unprocessed")]
    [ProducesResponseType(typeof(UnprocessedReceiptsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetUnprocessed()
    {
        var result = await _mediator.Send(new GetUnprocessedReceiptsQuery());

        _logger.LogInformation(
            "Retrieved {Count} unprocessed receipts at {Timestamp}",
            result.TotalCount,
            DateTime.UtcNow);

        return Ok(result);
    }

    /// <summary>
    /// Delete a receipt (soft delete) (AC-5.1.7).
    /// Sets DeletedAt timestamp and optionally removes file from S3.
    /// </summary>
    /// <param name="id">Receipt GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Receipt deleted successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If receipt not found</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteReceipt(Guid id)
    {
        var command = new DeleteReceiptCommand(id);
        await _mediator.Send(command);

        _logger.LogInformation(
            "Receipt deleted: {ReceiptId} at {Timestamp}",
            id,
            DateTime.UtcNow);

        return NoContent();
    }

    /// <summary>
    /// Process a receipt by creating an expense from it (AC-5.4.4, AC-5.4.7).
    /// Links the expense to the receipt and marks receipt as processed.
    /// </summary>
    /// <param name="id">Receipt GUID</param>
    /// <param name="request">Expense details to create from receipt</param>
    /// <returns>The newly created expense's ID</returns>
    /// <response code="201">Returns the newly created expense ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If receipt, property, or category not found</response>
    /// <response code="409">If receipt is already processed</response>
    [HttpPost("{id:guid}/process")]
    [ProducesResponseType(typeof(ProcessReceiptResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ProcessReceipt(Guid id, [FromBody] ProcessReceiptRequest request)
    {
        var command = new ProcessReceiptCommand(
            id,
            request.PropertyId,
            request.Amount,
            DateOnly.Parse(request.Date),
            request.CategoryId,
            request.Description,
            request.WorkOrderId);

        // Validate command
        var validationResult = await _processValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var expenseId = await _mediator.Send(command);

        _logger.LogInformation(
            "Receipt processed: ReceiptId={ReceiptId} ExpenseId={ExpenseId} at {Timestamp}",
            id,
            expenseId,
            DateTime.UtcNow);

        var response = new ProcessReceiptResponse(expenseId);

        return CreatedAtAction(
            "GetExpense",
            "Expenses",
            new { id = expenseId },
            response);
    }

    private ValidationProblemDetails CreateValidationProblemDetails(FluentValidation.Results.ValidationResult validationResult)
    {
        var errors = validationResult.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = "One or more validation errors occurred.",
            Status = StatusCodes.Status400BadRequest,
            Instance = HttpContext.Request.Path,
            Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
        };
    }
}

/// <summary>
/// Request model for generating a presigned upload URL (AC-5.1.1).
/// </summary>
public record GenerateUploadUrlRequest(
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId = null
);

/// <summary>
/// Request model for creating a receipt after S3 upload (AC-5.1.3).
/// </summary>
public record CreateReceiptRequest(
    string StorageKey,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId = null
);

/// <summary>
/// Response model for successful receipt creation.
/// </summary>
public record CreateReceiptResponse(
    Guid Id
);

/// <summary>
/// Request model for processing a receipt into an expense (AC-5.4.4).
/// </summary>
public record ProcessReceiptRequest(
    Guid PropertyId,
    decimal Amount,
    string Date,
    Guid CategoryId,
    string? Description = null,
    Guid? WorkOrderId = null
);

/// <summary>
/// Response model for successful receipt processing.
/// </summary>
public record ProcessReceiptResponse(
    Guid ExpenseId
);
