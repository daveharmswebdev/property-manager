using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.VendorPhotos;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Vendor photo management endpoints.
/// </summary>
[ApiController]
[Route("api/v1/vendors/{vendorId:guid}/photos")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
[Authorize(Policy = "CanAccessVendors")]
public class VendorPhotosController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GenerateVendorPhotoUploadUrlCommand> _uploadUrlValidator;
    private readonly IValidator<ConfirmVendorPhotoUploadCommand> _confirmValidator;
    private readonly IValidator<DeleteVendorPhotoCommand> _deleteValidator;
    private readonly IValidator<SetPrimaryVendorPhotoCommand> _setPrimaryValidator;
    private readonly IValidator<ReorderVendorPhotosCommand> _reorderValidator;
    private readonly ILogger<VendorPhotosController> _logger;

    public VendorPhotosController(
        IMediator mediator,
        IValidator<GenerateVendorPhotoUploadUrlCommand> uploadUrlValidator,
        IValidator<ConfirmVendorPhotoUploadCommand> confirmValidator,
        IValidator<DeleteVendorPhotoCommand> deleteValidator,
        IValidator<SetPrimaryVendorPhotoCommand> setPrimaryValidator,
        IValidator<ReorderVendorPhotosCommand> reorderValidator,
        ILogger<VendorPhotosController> logger)
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
    /// Generate a presigned S3 upload URL for a vendor photo.
    /// </summary>
    /// <param name="vendorId">Vendor GUID</param>
    /// <param name="request">Content type, file size, and original file name</param>
    /// <returns>Presigned upload URL details</returns>
    /// <response code="200">Returns presigned upload URL</response>
    /// <response code="400">If validation fails (invalid content type or file size)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor not found</response>
    [HttpPost("upload-url")]
    [ProducesResponseType(typeof(GenerateVendorPhotoUploadUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateUploadUrl(Guid vendorId, [FromBody] VendorPhotoUploadUrlRequest request)
    {
        var command = new GenerateVendorPhotoUploadUrlCommand(
            vendorId,
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
            "Generated vendor photo upload URL: VendorId={VendorId}, StorageKey={StorageKey}",
            vendorId,
            response.StorageKey);

        return Ok(response);
    }

    /// <summary>
    /// Confirm a vendor photo upload and create record.
    /// Auto-sets IsPrimary=true if this is the first photo for the vendor.
    /// </summary>
    /// <param name="vendorId">Vendor GUID</param>
    /// <param name="request">Storage keys, content type, file size, and original file name</param>
    /// <returns>Created photo details with URLs</returns>
    /// <response code="201">Returns created photo details</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor not found</response>
    [HttpPost]
    [ProducesResponseType(typeof(ConfirmVendorPhotoUploadResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConfirmUpload(Guid vendorId, [FromBody] VendorPhotoConfirmRequest request)
    {
        var command = new ConfirmVendorPhotoUploadCommand(
            vendorId,
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
            "Confirmed vendor photo upload: VendorId={VendorId}, PhotoId={PhotoId}",
            vendorId,
            response.Id);

        return Created($"/api/v1/vendors/{vendorId}/photos/{response.Id}", response);
    }

    /// <summary>
    /// Get all photos for a vendor ordered by DisplayOrder.
    /// </summary>
    /// <param name="vendorId">Vendor GUID</param>
    /// <returns>List of photos with presigned view URLs</returns>
    /// <response code="200">Returns list of photos</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor not found</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetVendorPhotosResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPhotos(Guid vendorId)
    {
        var query = new GetVendorPhotosQuery(vendorId);
        var response = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved {Count} photos for vendor: {VendorId}",
            response.Items.Count,
            vendorId);

        return Ok(response);
    }

    /// <summary>
    /// Delete a vendor photo.
    /// If deleted photo was primary, promotes next photo by DisplayOrder.
    /// </summary>
    /// <param name="vendorId">Vendor GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photo deleted successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor or photo not found</response>
    [HttpDelete("{photoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePhoto(Guid vendorId, Guid photoId)
    {
        var command = new DeleteVendorPhotoCommand(vendorId, photoId);

        var validationResult = await _deleteValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Deleted vendor photo: VendorId={VendorId}, PhotoId={PhotoId}",
            vendorId,
            photoId);

        return NoContent();
    }

    /// <summary>
    /// Set a photo as the primary photo for the vendor.
    /// Clears previous primary photo.
    /// </summary>
    /// <param name="vendorId">Vendor GUID</param>
    /// <param name="photoId">Photo GUID</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Primary photo set successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor or photo not found</response>
    [HttpPut("{photoId:guid}/primary")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPrimaryPhoto(Guid vendorId, Guid photoId)
    {
        var command = new SetPrimaryVendorPhotoCommand(vendorId, photoId);

        var validationResult = await _setPrimaryValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Set primary vendor photo: VendorId={VendorId}, PhotoId={PhotoId}",
            vendorId,
            photoId);

        return NoContent();
    }

    /// <summary>
    /// Reorder vendor photos.
    /// Updates DisplayOrder values based on array position.
    /// </summary>
    /// <param name="vendorId">Vendor GUID</param>
    /// <param name="request">Array of photo IDs in new order</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Photos reordered successfully</response>
    /// <response code="400">If validation fails or photo IDs don't match</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor or any photo not found</response>
    [HttpPut("reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderPhotos(Guid vendorId, [FromBody] ReorderVendorPhotosRequest request)
    {
        var command = new ReorderVendorPhotosCommand(vendorId, request.PhotoIds);

        var validationResult = await _reorderValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command);

        _logger.LogInformation(
            "Reordered vendor photos: VendorId={VendorId}, PhotoCount={PhotoCount}",
            vendorId,
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
/// Request model for generating a vendor photo upload URL.
/// </summary>
public record VendorPhotoUploadUrlRequest(
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for confirming a vendor photo upload.
/// </summary>
public record VendorPhotoConfirmRequest(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for reordering vendor photos.
/// </summary>
public record ReorderVendorPhotosRequest(
    List<Guid> PhotoIds);
