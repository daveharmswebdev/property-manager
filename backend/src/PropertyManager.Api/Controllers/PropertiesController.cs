using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Properties;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Property management endpoints for CRUD operations.
/// </summary>
[ApiController]
[Route("api/v1/properties")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class PropertiesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreatePropertyCommand> _createValidator;
    private readonly ILogger<PropertiesController> _logger;

    public PropertiesController(
        IMediator mediator,
        IValidator<CreatePropertyCommand> createValidator,
        ILogger<PropertiesController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Create a new property (AC-2.1.3).
    /// </summary>
    /// <param name="request">Property details</param>
    /// <returns>The newly created property's ID</returns>
    /// <response code="201">Returns the newly created property ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreatePropertyResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateProperty([FromBody] CreatePropertyRequest request)
    {
        var command = new CreatePropertyCommand(
            request.Name,
            request.Street,
            request.City,
            request.State,
            request.ZipCode);

        // Validate command
        var validationResult = await _createValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        var propertyId = await _mediator.Send(command);

        _logger.LogInformation(
            "Property created: {PropertyId} at {Timestamp}",
            propertyId,
            DateTime.UtcNow);

        var response = new CreatePropertyResponse(propertyId);

        return CreatedAtAction(
            nameof(CreateProperty),
            new { id = propertyId },
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
/// Request model for creating a property.
/// </summary>
public record CreatePropertyRequest(
    string Name,
    string Street,
    string City,
    string State,
    string ZipCode
);

/// <summary>
/// Response model for successful property creation.
/// </summary>
public record CreatePropertyResponse(
    Guid Id
);
