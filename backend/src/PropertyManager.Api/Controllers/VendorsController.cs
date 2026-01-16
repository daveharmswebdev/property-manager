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
    private readonly ILogger<VendorsController> _logger;

    public VendorsController(
        IMediator mediator,
        ILogger<VendorsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Get all vendors for the current user's account.
    /// </summary>
    /// <returns>List of vendors</returns>
    /// <response code="200">Returns the list of vendors</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAllVendorsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetAllVendors()
    {
        var query = new GetAllVendorsQuery();
        var response = await _mediator.Send(query);

        _logger.LogInformation(
            "Retrieved {Count} vendors at {Timestamp}",
            response.TotalCount,
            DateTime.UtcNow);

        return Ok(response);
    }
}
