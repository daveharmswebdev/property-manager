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
    private readonly ILogger<WorkOrdersController> _logger;

    public WorkOrdersController(
        IMediator mediator,
        ILogger<WorkOrdersController> logger)
    {
        _mediator = mediator;
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
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAllWorkOrdersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAllWorkOrders(
        [FromQuery] string? status,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var query = new GetAllWorkOrdersQuery(status, propertyId);
        var response = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation(
            "Retrieved {Count} work orders at {Timestamp}",
            response.TotalCount,
            DateTime.UtcNow);

        return Ok(response);
    }
}
