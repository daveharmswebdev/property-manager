using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Vendors;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Vendor management endpoints.
/// </summary>
[ApiController]
[Route("api/v1/vendors")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class VendorsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateVendorCommand> _createValidator;
    private readonly IValidator<UpdateVendorCommand> _updateValidator;
    private readonly IValidator<DeleteVendorCommand> _deleteValidator;
    private readonly ILogger<VendorsController> _logger;

    public VendorsController(
        IMediator mediator,
        IValidator<CreateVendorCommand> createValidator,
        IValidator<UpdateVendorCommand> updateValidator,
        IValidator<DeleteVendorCommand> deleteValidator,
        ILogger<VendorsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _deleteValidator = deleteValidator;
        _logger = logger;
    }

    /// <summary>
    /// Get all vendors for the current user's account.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of vendors</returns>
    /// <response code="200">Returns the list of vendors</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAllVendorsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAllVendors(CancellationToken cancellationToken)
    {
        var query = new GetAllVendorsQuery();
        var response = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation(
            "Retrieved {Count} vendors at {Timestamp}",
            response.TotalCount,
            DateTime.UtcNow);

        return Ok(response);
    }

    /// <summary>
    /// Get a single vendor by ID (AC #10).
    /// </summary>
    /// <param name="id">Vendor ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Vendor details including phones, emails, and trade tags</returns>
    /// <response code="200">Returns the vendor details</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor not found or belongs to different account</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(VendorDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVendor(
        Guid id,
        CancellationToken cancellationToken)
    {
        var query = new GetVendorQuery(id);
        var vendor = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation(
            "Retrieved vendor {VendorId}: {FullName} at {Timestamp}",
            vendor.Id,
            vendor.FullName,
            DateTime.UtcNow);

        return Ok(vendor);
    }

    /// <summary>
    /// Update an existing vendor (AC #12).
    /// </summary>
    /// <param name="id">Vendor ID</param>
    /// <param name="request">Updated vendor details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Vendor updated successfully</response>
    /// <response code="400">If validation fails or request body is null</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor not found or belongs to different account</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateVendor(
        Guid id,
        [FromBody] UpdateVendorRequest? request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            var problemDetails = new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                Title = "Bad Request",
                Status = StatusCodes.Status400BadRequest,
                Detail = "Request body is required",
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            };
            return BadRequest(problemDetails);
        }

        var command = new UpdateVendorCommand(
            id,
            request.FirstName,
            request.MiddleName,
            request.LastName,
            request.Phones.Select(p => new PhoneNumberDto(p.Number, p.Label)).ToList(),
            request.Emails.ToList(),
            request.TradeTagIds.ToList());

        // Validate command
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Vendor updated: {VendorId}, name {FirstName} {LastName} at {Timestamp}",
            id,
            request.FirstName,
            request.LastName,
            DateTime.UtcNow);

        return NoContent();
    }

    /// <summary>
    /// Create a new vendor (AC #7).
    /// </summary>
    /// <param name="request">Vendor details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The newly created vendor's ID</returns>
    /// <response code="201">Returns the newly created vendor ID</response>
    /// <response code="400">If validation fails or request body is null</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateVendorResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateVendor(
        [FromBody] CreateVendorRequest? request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            var problemDetails = new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                Title = "Bad Request",
                Status = StatusCodes.Status400BadRequest,
                Detail = "Request body is required",
                Instance = HttpContext.Request.Path,
                Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
            };
            return BadRequest(problemDetails);
        }

        var command = new CreateVendorCommand(
            request.FirstName,
            request.MiddleName,
            request.LastName);

        // Validate command
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var vendorId = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Vendor created: {VendorId}, name {FirstName} {LastName} at {Timestamp}",
            vendorId,
            request.FirstName,
            request.LastName,
            DateTime.UtcNow);

        var response = new CreateVendorResponse(vendorId);

        var locationUri = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}/api/v1/vendors/{vendorId}";
        return Created(locationUri, response);
    }

    /// <summary>
    /// Delete a vendor (soft delete) (FR12).
    /// </summary>
    /// <param name="id">Vendor ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Vendor deleted successfully</response>
    /// <response code="400">If validation fails (e.g., empty GUID)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If vendor not found or belongs to different account</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteVendor(
        Guid id,
        CancellationToken cancellationToken)
    {
        var command = new DeleteVendorCommand(id);

        // Validate command
        var validationResult = await _deleteValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Vendor deletion requested: {VendorId} at {Timestamp}",
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
/// Request model for creating a vendor (AC #7).
/// </summary>
public record CreateVendorRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string? MiddleName { get; init; }
    public string LastName { get; init; } = string.Empty;
}

/// <summary>
/// Response model for successful vendor creation.
/// </summary>
public record CreateVendorResponse(
    Guid Id
);

/// <summary>
/// Request model for updating a vendor (AC #12).
/// </summary>
public record UpdateVendorRequest
{
    public string FirstName { get; init; } = string.Empty;
    public string? MiddleName { get; init; }
    public string LastName { get; init; } = string.Empty;
    public List<PhoneNumberRequest> Phones { get; init; } = new();
    public List<string> Emails { get; init; } = new();
    public List<Guid> TradeTagIds { get; init; } = new();
}

/// <summary>
/// Request model for phone number in update vendor request.
/// </summary>
public record PhoneNumberRequest
{
    public string Number { get; init; } = string.Empty;
    public string? Label { get; init; }
}
