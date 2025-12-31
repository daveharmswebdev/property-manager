using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    private readonly ILogger<ReceiptsController> _logger;

    public ReceiptsController(
        IMediator mediator,
        IValidator<GenerateUploadUrlCommand> uploadUrlValidator,
        IValidator<CreateReceiptCommand> createValidator,
        ILogger<ReceiptsController> logger)
    {
        _mediator = mediator;
        _uploadUrlValidator = uploadUrlValidator;
        _createValidator = createValidator;
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
            request.StorageKey,
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
