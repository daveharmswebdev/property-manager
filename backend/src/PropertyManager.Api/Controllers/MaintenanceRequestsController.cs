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
    private readonly IValidator<ConvertMaintenanceRequestToWorkOrderCommand> _convertValidator;
    private readonly IValidator<DismissMaintenanceRequestCommand> _dismissValidator;
    private readonly ILogger<MaintenanceRequestsController> _logger;

    public MaintenanceRequestsController(
        IMediator mediator,
        IValidator<CreateMaintenanceRequestCommand> createValidator,
        IValidator<ConvertMaintenanceRequestToWorkOrderCommand> convertValidator,
        IValidator<DismissMaintenanceRequestCommand> dismissValidator,
        ILogger<MaintenanceRequestsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _convertValidator = convertValidator;
        _dismissValidator = dismissValidator;
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
    /// Get the current tenant's assigned property info (Story 20.5, AC #2).
    /// Returns read-only property data (name, address) — no financial data.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Tenant property info</returns>
    /// <response code="200">Returns the tenant's property info</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property not found</response>
    [HttpGet("tenant-property")]
    [ProducesResponseType(typeof(TenantPropertyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTenantProperty(CancellationToken cancellationToken)
    {
        var query = new GetTenantPropertyQuery();
        var result = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation("Retrieved tenant property {PropertyId}", result.Id);

        return Ok(result);
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

    /// <summary>
    /// Convert a maintenance request into a work order (Story 20.8, AC #5, #7, #10, #11).
    /// Atomically creates a WorkOrder (mirroring photos by sharing S3 keys), links the
    /// maintenance request to it, and transitions the request to InProgress.
    /// </summary>
    /// <param name="id">Maintenance request GUID</param>
    /// <param name="request">Convert request body — description, optional category, optional vendor</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The newly created work order id + linked maintenance request id</returns>
    /// <response code="201">Returns the new work order id and links to the work order endpoint</response>
    /// <response code="400">If validation fails or a business-rule violation occurs (e.g., wrong source status)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="403">If user lacks permission (Tenants lack WorkOrders.Create)</response>
    /// <response code="404">If the maintenance request, category, or vendor is not found</response>
    [HttpPost("{id:guid}/convert")]
    [Authorize(Policy = "CanManageWorkOrders")]
    [ProducesResponseType(typeof(ConvertMaintenanceRequestToWorkOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConvertToWorkOrder(
        Guid id,
        [FromBody] ConvertMaintenanceRequestRequest request,
        CancellationToken cancellationToken)
    {
        var command = new ConvertMaintenanceRequestToWorkOrderCommand(
            id,
            request.Description,
            request.CategoryId,
            request.VendorId);

        var validationResult = await _convertValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        var response = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Maintenance request {MaintenanceRequestId} converted to work order {WorkOrderId}",
            response.MaintenanceRequestId,
            response.WorkOrderId);

        // Location header resolves to GET /api/v1/work-orders/{id} via WorkOrdersController.GetWorkOrder (AC #7).
        return CreatedAtAction(
            nameof(WorkOrdersController.GetWorkOrder),
            "WorkOrders",
            new { id = response.WorkOrderId },
            response);
    }

    /// <summary>
    /// Dismiss a maintenance request with a landlord-provided reason (Story 20.9, AC #6, #7).
    /// Sets <c>DismissalReason</c> and transitions status from <c>Submitted</c> to <c>Dismissed</c>.
    /// </summary>
    /// <param name="id">Maintenance request GUID</param>
    /// <param name="request">Dismiss request body — reason text (required, max 2000 chars)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Dismissal succeeded; reload the request to see updated status</response>
    /// <response code="400">If validation fails or source status is not Submitted</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="403">If user lacks the MaintenanceRequests.Dismiss permission (Tenant/Contributor)</response>
    /// <response code="404">If the maintenance request is not found (including cross-account)</response>
    [HttpPost("{id:guid}/dismiss")]
    [Authorize(Policy = "CanDismissMaintenanceRequests")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DismissMaintenanceRequest(
        Guid id,
        [FromBody] DismissMaintenanceRequestRequest request,
        CancellationToken cancellationToken)
    {
        var command = new DismissMaintenanceRequestCommand(id, request.Reason);

        var validationResult = await _dismissValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Maintenance request {MaintenanceRequestId} dismissed", id);

        return NoContent();
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

/// <summary>
/// Request model for the convert-to-work-order endpoint (Story 20.8).
/// </summary>
public record ConvertMaintenanceRequestRequest(
    string Description,
    Guid? CategoryId,
    Guid? VendorId);

/// <summary>
/// Request model for the dismiss endpoint (Story 20.9).
/// </summary>
public record DismissMaintenanceRequestRequest(string Reason);
