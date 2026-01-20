using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.PropertyPhotos;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Property photo management endpoints (AC-13.3a).
/// </summary>
[ApiController]
[Route("api/v1/properties/{propertyId:guid}/photos")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class PropertyPhotosController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GeneratePropertyPhotoUploadUrlCommand> _uploadUrlValidator;
    private readonly IValidator<ConfirmPropertyPhotoUploadCommand> _confirmValidator;
    private readonly IValidator<DeletePropertyPhotoCommand> _deleteValidator;
    private readonly IValidator<SetPrimaryPropertyPhotoCommand> _setPrimaryValidator;
    private readonly IValidator<ReorderPropertyPhotosCommand> _reorderValidator;
    private readonly ILogger<PropertyPhotosController> _logger;

    public PropertyPhotosController(
        IMediator mediator,
        IValidator<GeneratePropertyPhotoUploadUrlCommand> uploadUrlValidator,
        IValidator<ConfirmPropertyPhotoUploadCommand> confirmValidator,
        IValidator<DeletePropertyPhotoCommand> deleteValidator,
        IValidator<SetPrimaryPropertyPhotoCommand> setPrimaryValidator,
        IValidator<ReorderPropertyPhotosCommand> reorderValidator,
        ILogger<PropertyPhotosController> logger)
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
    /// Generate a presigned S3 upload URL for a property photo (AC-13.3a.3).
    /// </summary>
    /// <param name="propertyId">Property GUID</param>
    /// <param name="request">Content type, file size, and original file name</param>
    /// <returns>Presigned upload URL details</returns>
    /// <response code="200">Returns presigned upload URL</response>
    /// <response code="400">If validation fails (invalid content type or file size)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found</response>
    [HttpPost("upload-url")]
    [ProducesResponseType(typeof(GeneratePropertyPhotoUploadUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateUploadUrl(Guid propertyId, [FromBody] PropertyPhotoUploadUrlRequest request)
    {
        var command = new GeneratePropertyPhotoUploadUrlCommand(
            propertyId,
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
            "Generated property photo upload URL: PropertyId={PropertyId}, StorageKey={StorageKey}",
            propertyId,
            response.StorageKey);

        return Ok(response);
    }

    /// <summary>
    /// Confirm a property photo upload and create record (AC-13.3a.4).
    /// Auto-sets IsPrimary=true if this is the first photo for the property.
    /// </summary>
    /// <param name="propertyId">Property GUID</param>
    /// <param name="request">Storage keys, content type, file size, and original file name</param>
    /// <returns>Created photo details with URLs</returns>
    /// <response code="201">Returns created photo details</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found</response>
    [HttpPost]
    [ProducesResponseType(typeof(ConfirmPropertyPhotoUploadResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConfirmUpload(Guid propertyId, [FromBody] PropertyPhotoConfirmRequest request)
    {
        var command = new ConfirmPropertyPhotoUploadCommand(
            propertyId,
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
            "Confirmed property photo upload: PropertyId={PropertyId}, PhotoId={PhotoId}",
            propertyId,
            response.Id);

        return Created($"/api/v1/properties/{propertyId}/photos/{response.Id}", response);
    }

    /// <summary>
    /// Get all photos for a property ordered by DisplayOrder (AC-13.3a.8).
    /// </summary>
    /// <param name="propertyId">Property GUID</param>
    /// <returns>List of photos with presigned view URLs</returns>
    /// <response code="200">Returns list of photos</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetPropertyPhotosResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPhotos(Guid propertyId)
    {
        var query = new GetPropertyPhotosQuery(propertyId);
        var response = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved {Count} photos for property: {PropertyId}",
            response.Items.Count,
            propertyId);

        return Ok(response);
    }

    /// <summary>
    /// Delete a property photo (AC-13.3a.5).
    /// If deleted photo was primary, promotes next photo by DisplayOrder.
    /// </summary>
    /// <param name="propertyId">Property GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photo deleted successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property or photo not found</response>
    [HttpDelete("{photoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePhoto(Guid propertyId, Guid photoId)
    {
        var command = new DeletePropertyPhotoCommand(propertyId, photoId);

        var validationResult = await _deleteValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Deleted property photo: PropertyId={PropertyId}, PhotoId={PhotoId}",
            propertyId,
            photoId);

        return NoContent();
    }

    /// <summary>
    /// Set a photo as the primary photo for the property (AC-13.3a.6).
    /// Clears previous primary photo.
    /// </summary>
    /// <param name="propertyId">Property GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Primary photo set successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property or photo not found</response>
    [HttpPut("{photoId:guid}/primary")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPrimaryPhoto(Guid propertyId, Guid photoId)
    {
        var command = new SetPrimaryPropertyPhotoCommand(propertyId, photoId);

        var validationResult = await _setPrimaryValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Set primary property photo: PropertyId={PropertyId}, PhotoId={PhotoId}",
            propertyId,
            photoId);

        return NoContent();
    }

    /// <summary>
    /// Reorder property photos (AC-13.3a.7).
    /// Updates DisplayOrder values based on array position.
    /// </summary>
    /// <param name="propertyId">Property GUID</param>
    /// <param name="request">Array of photo IDs in new order</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photos reordered successfully</response>
    /// <response code="400">If validation fails or photo IDs don't match</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property or any photo not found</response>
    [HttpPut("reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderPhotos(Guid propertyId, [FromBody] ReorderPropertyPhotosRequest request)
    {
        var command = new ReorderPropertyPhotosCommand(propertyId, request.PhotoIds);

        var validationResult = await _reorderValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Reordered property photos: PropertyId={PropertyId}, PhotoCount={PhotoCount}",
            propertyId,
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
/// Request model for generating a property photo upload URL.
/// </summary>
public record PropertyPhotoUploadUrlRequest(
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for confirming a property photo upload.
/// </summary>
public record PropertyPhotoConfirmRequest(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for reordering property photos.
/// </summary>
public record ReorderPropertyPhotosRequest(
    List<Guid> PhotoIds);
