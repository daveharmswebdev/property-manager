using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Photos;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Generic photo management endpoints for S3 presigned URL uploads.
/// </summary>
[ApiController]
[Route("api/v1/photos")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class PhotosController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GeneratePhotoUploadUrlCommand> _uploadUrlValidator;
    private readonly IValidator<ConfirmPhotoUploadCommand> _confirmValidator;
    private readonly ILogger<PhotosController> _logger;

    public PhotosController(
        IMediator mediator,
        IValidator<GeneratePhotoUploadUrlCommand> uploadUrlValidator,
        IValidator<ConfirmPhotoUploadCommand> confirmValidator,
        ILogger<PhotosController> logger)
    {
        _mediator = mediator;
        _uploadUrlValidator = uploadUrlValidator;
        _confirmValidator = confirmValidator;
        _logger = logger;
    }

    /// <summary>
    /// Generate a presigned S3 upload URL for a photo.
    /// </summary>
    /// <param name="request">Entity type, entity ID, content type, file size, and original file name</param>
    /// <returns>Presigned upload URL details</returns>
    /// <response code="200">Returns presigned upload URL</response>
    /// <response code="400">If validation fails (invalid content type or file size)</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost("upload-url")]
    [ProducesResponseType(typeof(GeneratePhotoUploadUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GenerateUploadUrl([FromBody] PhotoUploadUrlRequest request)
    {
        var command = new GeneratePhotoUploadUrlCommand(
            request.EntityType,
            request.EntityId,
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
            "Generated photo upload URL: EntityType={EntityType}, EntityId={EntityId}, StorageKey={StorageKey}, ExpiresAt={ExpiresAt}",
            request.EntityType,
            request.EntityId,
            response.StorageKey,
            response.ExpiresAt);

        return Ok(response);
    }

    /// <summary>
    /// Confirm a photo upload and trigger thumbnail generation.
    /// </summary>
    /// <param name="request">Storage key, thumbnail storage key, content type, and file size</param>
    /// <returns>Confirmed photo details</returns>
    /// <response code="200">Returns confirmed photo details</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost("confirm")]
    [ProducesResponseType(typeof(ConfirmPhotoUploadResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ConfirmUpload([FromBody] PhotoConfirmRequest request)
    {
        var command = new ConfirmPhotoUploadCommand(
            request.StorageKey,
            request.ThumbnailStorageKey,
            request.ContentType,
            request.FileSizeBytes);

        var validationResult = await _confirmValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var response = await _mediator.Send(command);

        _logger.LogInformation(
            "Confirmed photo upload: StorageKey={StorageKey}, ThumbnailStorageKey={ThumbnailStorageKey}",
            response.StorageKey,
            response.ThumbnailStorageKey);

        return Ok(response);
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
/// Request model for generating a photo upload URL.
/// </summary>
public record PhotoUploadUrlRequest(
    PhotoEntityType EntityType,
    Guid EntityId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Request model for confirming a photo upload.
/// </summary>
public record PhotoConfirmRequest(
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes);
