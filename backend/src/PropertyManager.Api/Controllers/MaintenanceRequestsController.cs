using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.MaintenanceRequests;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Maintenance request management endpoints.
/// </summary>
[ApiController]
[Route("api/v1/maintenance-requests")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class MaintenanceRequestsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateMaintenanceRequestCommand> _createValidator;
    private readonly ILogger<MaintenanceRequestsController> _logger;

    public MaintenanceRequestsController(
        IMediator mediator,
        IValidator<CreateMaintenanceRequestCommand> createValidator,
        ILogger<MaintenanceRequestsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Create a new maintenance request (AC #4).
    /// </summary>
    /// <param name="request">Maintenance request details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The newly created maintenance request ID</returns>
    /// <response code="201">Returns the newly created maintenance request ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="403">If user lacks permission</response>
    [HttpPost]
    [Authorize(Policy = "CanCreateMaintenanceRequests")]
    [ProducesResponseType(typeof(CreateMaintenanceRequestResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateMaintenanceRequest(
        [FromBody] CreateMaintenanceRequestRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateMaintenanceRequestCommand(request.Description);

        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        var id = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Maintenance request created: {MaintenanceRequestId}", id);

        return CreatedAtAction(
            nameof(GetMaintenanceRequestById),
            new { id },
            new CreateMaintenanceRequestResponse(id));
    }

    /// <summary>
    /// Get maintenance requests with role-based filtering and pagination (AC #5, #6).
    /// Tenants see requests for their property. Landlords see all requests.
    /// </summary>
    /// <param name="status">Optional status filter</param>
    /// <param name="propertyId">Optional property filter (for landlords)</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 20)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Paginated list of maintenance requests</returns>
    /// <response code="200">Returns the paginated list of maintenance requests</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetMaintenanceRequestsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMaintenanceRequests(
        [FromQuery] string? status,
        [FromQuery] Guid? propertyId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new GetMaintenanceRequestsQuery(status, propertyId, page, pageSize);
        var response = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation("Retrieved {Count} maintenance requests (page {Page})",
            response.TotalCount, page);

        return Ok(response);
    }

    /// <summary>
    /// Get a single maintenance request by ID (AC #7).
    /// </summary>
    /// <param name="id">Maintenance request GUID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Maintenance request details</returns>
    /// <response code="200">Returns the maintenance request</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If maintenance request not found</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MaintenanceRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMaintenanceRequestById(Guid id, CancellationToken cancellationToken)
    {
        var query = new GetMaintenanceRequestByIdQuery(id);
        var result = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation("Retrieved maintenance request {MaintenanceRequestId}", id);

        return Ok(result);
    }
}

/// <summary>
/// Request model for creating a maintenance request.
/// </summary>
public record CreateMaintenanceRequestRequest(string Description);

/// <summary>
/// Response model for successful maintenance request creation.
/// </summary>
public record CreateMaintenanceRequestResponse(Guid Id);
