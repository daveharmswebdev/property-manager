using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.MaintenanceRequestPhotos;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Maintenance request photo management endpoints.
/// </summary>
[ApiController]
[Route("api/v1/maintenance-requests/{maintenanceRequestId:guid}/photos")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class MaintenanceRequestPhotosController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GenerateMaintenanceRequestPhotoUploadUrlCommand> _uploadUrlValidator;
    private readonly IValidator<ConfirmMaintenanceRequestPhotoUploadCommand> _confirmValidator;
    private readonly IValidator<DeleteMaintenanceRequestPhotoCommand> _deleteValidator;
    private readonly ILogger<MaintenanceRequestPhotosController> _logger;

    public MaintenanceRequestPhotosController(
        IMediator mediator,
        IValidator<GenerateMaintenanceRequestPhotoUploadUrlCommand> uploadUrlValidator,
        IValidator<ConfirmMaintenanceRequestPhotoUploadCommand> confirmValidator,
        IValidator<DeleteMaintenanceRequestPhotoCommand> deleteValidator,
        ILogger<MaintenanceRequestPhotosController> logger)
    {
        _mediator = mediator;
        _uploadUrlValidator = uploadUrlValidator;
        _confirmValidator = confirmValidator;
        _deleteValidator = deleteValidator;
        _logger = logger;
    }

    /// <summary>
    /// Generate a presigned S3 upload URL for a maintenance request photo.
    /// </summary>
    /// <param name="maintenanceRequestId">Maintenance request GUID</param>
    /// <param name="request">Content type, file size, and original file name</param>
    /// <returns>Presigned upload URL details</returns>
    /// <response code="200">Returns presigned upload URL</response>
    /// <response code="400">If validation fails (invalid content type or file size)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If maintenance request not found</response>
    [HttpPost("upload-url")]
    [ProducesResponseType(typeof(GenerateMaintenanceRequestPhotoUploadUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateUploadUrl(Guid maintenanceRequestId, [FromBody] MaintenanceRequestPhotoUploadUrlRequest request)
    {
        var command = new GenerateMaintenanceRequestPhotoUploadUrlCommand(
            maintenanceRequestId,
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
            "Generated maintenance request photo upload URL: MaintenanceRequestId={MaintenanceRequestId}, StorageKey={StorageKey}",
            maintenanceRequestId,
            response.StorageKey);

        return Ok(response);
    }

    /// <summary>
    /// Confirm a maintenance request photo upload and create record.
    /// Auto-sets IsPrimary=true if this is the first photo for the maintenance request.
    /// </summary>
    /// <param name="maintenanceRequestId">Maintenance request GUID</param>
    /// <param name="request">Storage keys, content type, file size, and original file name</param>
    /// <returns>Created photo details with URLs</returns>
    /// <response code="201">Returns created photo details</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If maintenance request not found</response>
    [HttpPost]
    [ProducesResponseType(typeof(ConfirmMaintenanceRequestPhotoUploadResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConfirmUpload(Guid maintenanceRequestId, [FromBody] MaintenanceRequestPhotoConfirmRequest request)
    {
        var command = new ConfirmMaintenanceRequestPhotoUploadCommand(
            maintenanceRequestId,
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
            "Confirmed maintenance request photo upload: MaintenanceRequestId={MaintenanceRequestId}, PhotoId={PhotoId}",
            maintenanceRequestId,
            response.Id);

        return Created($"/api/v1/maintenance-requests/{maintenanceRequestId}/photos/{response.Id}", response);
    }

    /// <summary>
    /// Get all photos for a maintenance request ordered by DisplayOrder.
    /// </summary>
    /// <param name="maintenanceRequestId">Maintenance request GUID</param>
    /// <returns>List of photos with presigned view URLs</returns>
    /// <response code="200">Returns list of photos</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If maintenance request not found</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetMaintenanceRequestPhotosResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPhotos(Guid maintenanceRequestId)
    {
        var query = new GetMaintenanceRequestPhotosQuery(maintenanceRequestId);
        var response = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved {Count} photos for maintenance request: {MaintenanceRequestId}",
            response.Items.Count,
            maintenanceRequestId);

        return Ok(response);
    }

    /// <summary>
    /// Delete a maintenance request photo.
    /// If deleted photo was primary, promotes next photo by DisplayOrder.
    /// </summary>
    /// <param name="maintenanceRequestId">Maintenance request GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photo deleted successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If maintenance request or photo not found</response>
    [HttpDelete("{photoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePhoto(Guid maintenanceRequestId, Guid photoId)
    {
        var command = new DeleteMaintenanceRequestPhotoCommand(maintenanceRequestId, photoId);

        var validationResult = await _deleteValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Deleted maintenance request photo: MaintenanceRequestId={MaintenanceRequestId}, PhotoId={PhotoId}",
            maintenanceRequestId,
            photoId);

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
/// Request model for generating a maintenance request photo upload URL.
/// </summary>
public record MaintenanceRequestPhotoUploadUrlRequest(
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for confirming a maintenance request photo upload.
/// </summary>
public record MaintenanceRequestPhotoConfirmRequest(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);
