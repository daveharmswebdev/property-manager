using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.WorkOrderTags;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Work order tag management endpoints (AC #1, #2, #3, #4).
/// </summary>
[ApiController]
[Route("api/v1/work-order-tags")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class WorkOrderTagsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateWorkOrderTagCommand> _createValidator;
    private readonly ILogger<WorkOrderTagsController> _logger;

    public WorkOrderTagsController(
        IMediator mediator,
        IValidator<CreateWorkOrderTagCommand> createValidator,
        ILogger<WorkOrderTagsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Get all work order tags for the current user's account (AC #1).
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of work order tags sorted alphabetically by name</returns>
    /// <response code="200">Returns the list of work order tags</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAllWorkOrderTagsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAllWorkOrderTags(CancellationToken cancellationToken)
    {
        var query = new GetAllWorkOrderTagsQuery();
        var response = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation(
            "Retrieved {Count} work order tags",
            response.TotalCount);

        return Ok(response);
    }

    /// <summary>
    /// Create a new work order tag (AC #2, #3, #4).
    /// </summary>
    /// <param name="request">Work order tag creation request with name</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created work order tag ID</returns>
    /// <response code="201">Work order tag created successfully</response>
    /// <response code="400">If validation fails (name required, max 100 chars)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="409">If a work order tag with that name already exists for the account</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateWorkOrderTagResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateWorkOrderTag(
        [FromBody] CreateWorkOrderTagRequest? request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest(new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                Title = "Invalid request",
                Status = StatusCodes.Status400BadRequest,
                Detail = "Request body is required",
                Instance = HttpContext.Request.Path
            });
        }

        var command = new CreateWorkOrderTagCommand(request.Name);

        // Validate command
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );

            var problemDetails = new ValidationProblemDetails(errors)
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
                Title = "Validation error",
                Status = StatusCodes.Status400BadRequest,
                Instance = HttpContext.Request.Path
            };
            problemDetails.Extensions["traceId"] = HttpContext.TraceIdentifier;

            return BadRequest(problemDetails);
        }

        var tagId = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Work order tag created: {TagId}, name '{Name}'",
            tagId,
            request.Name);

        var response = new CreateWorkOrderTagResponse(tagId);

        return CreatedAtAction(
            nameof(GetAllWorkOrderTags),
            null,
            response);
    }
}

/// <summary>
/// Request model for creating a work order tag.
/// </summary>
public record CreateWorkOrderTagRequest(string Name);

/// <summary>
/// Response model for work order tag creation.
/// </summary>
public record CreateWorkOrderTagResponse(Guid Id);
