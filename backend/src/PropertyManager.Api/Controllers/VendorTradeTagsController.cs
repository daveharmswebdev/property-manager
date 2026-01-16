using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.VendorTradeTags;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Vendor trade tag management endpoints (AC #3, #4, #5).
/// </summary>
[ApiController]
[Route("api/v1/vendor-trade-tags")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class VendorTradeTagsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateVendorTradeTagCommand> _createValidator;
    private readonly ILogger<VendorTradeTagsController> _logger;

    public VendorTradeTagsController(
        IMediator mediator,
        IValidator<CreateVendorTradeTagCommand> createValidator,
        ILogger<VendorTradeTagsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Get all vendor trade tags for the current user's account (AC #3).
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of trade tags sorted alphabetically by name</returns>
    /// <response code="200">Returns the list of trade tags</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAllVendorTradeTagsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAllVendorTradeTags(CancellationToken cancellationToken)
    {
        var query = new GetAllVendorTradeTagsQuery();
        var response = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation(
            "Retrieved {Count} vendor trade tags",
            response.TotalCount);

        return Ok(response);
    }

    /// <summary>
    /// Create a new vendor trade tag (AC #4, #5).
    /// </summary>
    /// <param name="request">Trade tag creation request with name</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Created trade tag ID</returns>
    /// <response code="201">Trade tag created successfully</response>
    /// <response code="400">If validation fails (name required, max 100 chars)</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="409">If a trade tag with that name already exists for the account</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateVendorTradeTagResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateVendorTradeTag(
        [FromBody] CreateVendorTradeTagRequest? request,
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

        var command = new CreateVendorTradeTagCommand(request.Name);

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

        var tradeTagId = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Trade tag created: {TradeTagId}, name '{Name}'",
            tradeTagId,
            request.Name);

        var response = new CreateVendorTradeTagResponse(tradeTagId);

        return CreatedAtAction(
            nameof(GetAllVendorTradeTags),
            null,
            response);
    }
}

/// <summary>
/// Request model for creating a vendor trade tag.
/// </summary>
public record CreateVendorTradeTagRequest(string Name);

/// <summary>
/// Response model for trade tag creation.
/// </summary>
public record CreateVendorTradeTagResponse(Guid Id);
