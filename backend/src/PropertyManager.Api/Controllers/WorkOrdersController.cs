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
    private readonly ILogger<WorkOrdersController> _logger;

    public WorkOrdersController(
        IMediator mediator,
        IValidator<GetAllWorkOrdersQuery> getAllValidator,
        ILogger<WorkOrdersController> logger)
    {
        _mediator = mediator;
        _getAllValidator = getAllValidator;
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
}
