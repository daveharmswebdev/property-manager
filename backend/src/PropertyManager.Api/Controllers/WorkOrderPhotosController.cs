using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Work order photo management endpoints.
/// Story 10-4: Core photo upload/delete functionality.
/// Story 10-6: Primary photo selection and reordering (symmetric with property photos).
/// </summary>
[ApiController]
[Route("api/v1/work-orders/{workOrderId:guid}/photos")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class WorkOrderPhotosController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GenerateWorkOrderPhotoUploadUrlCommand> _uploadUrlValidator;
    private readonly IValidator<ConfirmWorkOrderPhotoUploadCommand> _confirmValidator;
    private readonly IValidator<DeleteWorkOrderPhotoCommand> _deleteValidator;
    private readonly IValidator<SetPrimaryWorkOrderPhotoCommand> _setPrimaryValidator;
    private readonly IValidator<ReorderWorkOrderPhotosCommand> _reorderValidator;
    private readonly ILogger<WorkOrderPhotosController> _logger;

    public WorkOrderPhotosController(
        IMediator mediator,
        IValidator<GenerateWorkOrderPhotoUploadUrlCommand> uploadUrlValidator,
        IValidator<ConfirmWorkOrderPhotoUploadCommand> confirmValidator,
        IValidator<DeleteWorkOrderPhotoCommand> deleteValidator,
        IValidator<SetPrimaryWorkOrderPhotoCommand> setPrimaryValidator,
        IValidator<ReorderWorkOrderPhotosCommand> reorderValidator,
        ILogger<WorkOrderPhotosController> logger)
    {
        _mediator = mediator;
        _uploadUrlValidator = uploadUrlValidator;
        _confirmValidator = confirmValidator;
        _deleteValidator = deleteValidator;
        _setPrimaryValidator = setPrimaryValidator;
        _reorderValidator = reorderValidator;
        _logger = logger;
    }

    /// <summary>
    /// Generate a presigned S3 upload URL for a work order photo (AC #3).
    /// </summary>
    /// <param name="workOrderId">Work order GUID</param>
    /// <param name="request">Content type, file size, and original file name</param>
    /// <returns>Presigned upload URL details</returns>
    /// <response code="200">Returns presigned upload URL</response>
    /// <response code="400">If validation fails (invalid content type or file size)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order not found</response>
    [HttpPost("upload-url")]
    [ProducesResponseType(typeof(GenerateWorkOrderPhotoUploadUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateUploadUrl(Guid workOrderId, [FromBody] WorkOrderPhotoUploadUrlRequest request)
    {
        var command = new GenerateWorkOrderPhotoUploadUrlCommand(
            workOrderId,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var validationResult = await _uploadUrlValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var response = await _mediator.Send(command);

        _logger.LogInformation(
            "Generated work order photo upload URL: WorkOrderId={WorkOrderId}, StorageKey={StorageKey}",
            workOrderId,
            response.StorageKey);

        return Ok(response);
    }

    /// <summary>
    /// Confirm a work order photo upload and create record (AC #4).
    /// </summary>
    /// <param name="workOrderId">Work order GUID</param>
    /// <param name="request">Storage keys, content type, file size, and original file name</param>
    /// <returns>Created photo details with URLs</returns>
    /// <response code="201">Returns created photo details</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order not found</response>
    [HttpPost]
    [ProducesResponseType(typeof(ConfirmWorkOrderPhotoUploadResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConfirmUpload(Guid workOrderId, [FromBody] WorkOrderPhotoConfirmRequest request)
    {
        var command = new ConfirmWorkOrderPhotoUploadCommand(
            workOrderId,
            request.StorageKey,
            request.ThumbnailStorageKey,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var validationResult = await _confirmValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var response = await _mediator.Send(command);

        _logger.LogInformation(
            "Confirmed work order photo upload: WorkOrderId={WorkOrderId}, PhotoId={PhotoId}",
            workOrderId,
            response.Id);

        return Created($"/api/v1/work-orders/{workOrderId}/photos/{response.Id}", response);
    }

    /// <summary>
    /// Get all photos for a work order sorted by DisplayOrder (AC #5).
    /// </summary>
    /// <param name="workOrderId">Work order GUID</param>
    /// <returns>List of photos with presigned view URLs</returns>
    /// <response code="200">Returns list of photos</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order not found</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetWorkOrderPhotosResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPhotos(Guid workOrderId)
    {
        var query = new GetWorkOrderPhotosQuery(workOrderId);
        var response = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved {Count} photos for work order: {WorkOrderId}",
            response.Items.Count,
            workOrderId);

        return Ok(response);
    }

    /// <summary>
    /// Delete a work order photo (AC #6).
    /// </summary>
    /// <param name="workOrderId">Work order GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photo deleted successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order or photo not found</response>
    [HttpDelete("{photoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePhoto(Guid workOrderId, Guid photoId)
    {
        var command = new DeleteWorkOrderPhotoCommand(workOrderId, photoId);

        var validationResult = await _deleteValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Deleted work order photo: WorkOrderId={WorkOrderId}, PhotoId={PhotoId}",
            workOrderId,
            photoId);

        return NoContent();
    }

    /// <summary>
    /// Set a photo as the primary photo for the work order.
    /// Clears previous primary photo.
    /// </summary>
    /// <param name="workOrderId">Work order GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Primary photo set successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order or photo not found</response>
    [HttpPut("{photoId:guid}/primary")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPrimaryPhoto(Guid workOrderId, Guid photoId)
    {
        var command = new SetPrimaryWorkOrderPhotoCommand(workOrderId, photoId);

        var validationResult = await _setPrimaryValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Set primary work order photo: WorkOrderId={WorkOrderId}, PhotoId={PhotoId}",
            workOrderId,
            photoId);

        return NoContent();
    }

    /// <summary>
    /// Reorder work order photos.
    /// Updates DisplayOrder values based on array position.
    /// </summary>
    /// <param name="workOrderId">Work order GUID</param>
    /// <param name="request">Array of photo IDs in new order</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photos reordered successfully</response>
    /// <response code="400">If validation fails or photo IDs don't match</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order or any photo not found</response>
    [HttpPut("reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderPhotos(Guid workOrderId, [FromBody] ReorderWorkOrderPhotosRequest request)
    {
        var command = new ReorderWorkOrderPhotosCommand(workOrderId, request.PhotoIds);

        var validationResult = await _reorderValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Reordered work order photos: WorkOrderId={WorkOrderId}, PhotoCount={PhotoCount}",
            workOrderId,
            request.PhotoIds.Count);

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
/// Request model for generating a work order photo upload URL.
/// </summary>
public record WorkOrderPhotoUploadUrlRequest(
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for confirming a work order photo upload.
/// </summary>
public record WorkOrderPhotoConfirmRequest(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for reordering work order photos.
/// </summary>
public record ReorderWorkOrderPhotosRequest(
    List<Guid> PhotoIds);
