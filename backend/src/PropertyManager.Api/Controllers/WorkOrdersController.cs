using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Work order management endpoints.
/// </summary>
[ApiController]
[Route("api/v1/work-orders")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class WorkOrdersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<GetAllWorkOrdersQuery> _getAllValidator;
    private readonly IValidator<CreateWorkOrderCommand> _createValidator;
    private readonly IValidator<UpdateWorkOrderCommand> _updateValidator;
    private readonly IValidator<DeleteWorkOrderCommand> _deleteValidator;
    private readonly ILogger<WorkOrdersController> _logger;

    public WorkOrdersController(
        IMediator mediator,
        IValidator<GetAllWorkOrdersQuery> getAllValidator,
        IValidator<CreateWorkOrderCommand> createValidator,
        IValidator<UpdateWorkOrderCommand> updateValidator,
        IValidator<DeleteWorkOrderCommand> deleteValidator,
        ILogger<WorkOrdersController> logger)
    {
        _mediator = mediator;
        _getAllValidator = getAllValidator;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _deleteValidator = deleteValidator;
        _logger = logger;
    }

    /// <summary>
    /// Get all work orders for the current user's account (AC #8).
    /// </summary>
    /// <param name="status">Optional status filter (Reported, Assigned, Completed)</param>
    /// <param name="propertyId">Optional property filter</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of work orders</returns>
    /// <response code="200">Returns the list of work orders</response>
    /// <response code="400">If status filter is invalid</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAllWorkOrdersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAllWorkOrders(
        [FromQuery] string? status,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var query = new GetAllWorkOrdersQuery(status, propertyId);

        var validationResult = await _getAllValidator.ValidateAsync(query, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        var response = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation("Retrieved {Count} work orders", response.TotalCount);

        return Ok(response);
    }

    /// <summary>
    /// Create a new work order (AC #1, #2, #3, #4, #5).
    /// </summary>
    /// <param name="request">Work order details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The newly created work order ID</returns>
    /// <response code="201">Returns the newly created work order ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If property or category not found</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateWorkOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateWorkOrder(
        [FromBody] CreateWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateWorkOrderCommand(
            request.PropertyId,
            request.Description,
            request.CategoryId,
            request.Status,
            request.VendorId,
            request.TagIds);

        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        var id = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Work order created: {WorkOrderId} for property {PropertyId}",
            id, request.PropertyId);

        return CreatedAtAction(
            nameof(GetWorkOrder),
            new { id },
            new CreateWorkOrderResponse(id));
    }

    /// <summary>
    /// Get a single work order by ID.
    /// </summary>
    /// <param name="id">Work order GUID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Work order details</returns>
    /// <response code="200">Returns the work order</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order not found</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WorkOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWorkOrder(Guid id, CancellationToken cancellationToken)
    {
        var query = new GetWorkOrderQuery(id);
        var workOrder = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation("Retrieved work order {WorkOrderId}", id);

        return Ok(workOrder);
    }

    /// <summary>
    /// Update an existing work order (AC #6, #7).
    /// </summary>
    /// <param name="id">Work order GUID</param>
    /// <param name="request">Updated work order details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Work order updated successfully</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order, category, or tag not found</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateWorkOrder(
        Guid id,
        [FromBody] UpdateWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateWorkOrderCommand(
            id,
            request.Description,
            request.CategoryId,
            request.Status,
            request.VendorId,
            request.TagIds);

        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Work order updated: {WorkOrderId}", id);

        return NoContent();
    }

    /// <summary>
    /// Delete a work order (soft delete).
    /// </summary>
    /// <param name="id">Work order GUID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Work order deleted successfully</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If work order not found</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteWorkOrder(Guid id, CancellationToken cancellationToken)
    {
        var command = new DeleteWorkOrderCommand(id);

        var validationResult = await _deleteValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Work order deleted: {WorkOrderId}", id);

        return NoContent();
    }
}

/// <summary>
/// Request model for creating a work order.
/// </summary>
public record CreateWorkOrderRequest(
    Guid PropertyId,
    string Description,
    Guid? CategoryId,
    string? Status,
    Guid? VendorId = null,
    List<Guid>? TagIds = null
);

/// <summary>
/// Response model for successful work order creation.
/// </summary>
public record CreateWorkOrderResponse(Guid Id);

/// <summary>
/// Request model for updating a work order.
/// </summary>
public record UpdateWorkOrderRequest(
    string Description,
    Guid? CategoryId,
    string? Status,
    Guid? VendorId,
    List<Guid>? TagIds = null
);
