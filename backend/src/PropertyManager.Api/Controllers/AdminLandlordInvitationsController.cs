using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Invitations;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Admin endpoints for provisioning new top-level landlord accounts (Story 22.2).
/// Gated by the platform-level CanInviteLandlords policy (Story 22.1).
/// </summary>
[ApiController]
[Route("api/v1/admin/landlord-invitations")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme, Policy = "CanInviteLandlords")]
public class AdminLandlordInvitationsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateLandlordInvitationCommand> _createValidator;
    private readonly ILogger<AdminLandlordInvitationsController> _logger;

    public AdminLandlordInvitationsController(
        IMediator mediator,
        IValidator<CreateLandlordInvitationCommand> createValidator,
        ILogger<AdminLandlordInvitationsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Invite a new landlord — creates an Invitation with AccountId=null. When accepted,
    /// a new top-level Account is provisioned and the invited user becomes its Owner.
    /// </summary>
    /// <param name="request">Invitation details — only the recipient email.</param>
    /// <returns>InvitationId on success.</returns>
    /// <response code="201">Invitation created and email sent.</response>
    /// <response code="400">If email is missing/malformed, already registered, or already has a pending invitation.</response>
    /// <response code="401">If not authenticated.</response>
    /// <response code="403">If caller lacks the PlatformAdmin claim.</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateLandlordInvitationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateLandlordInvitation([FromBody] CreateLandlordInvitationRequest request)
    {
        var command = new CreateLandlordInvitationCommand(request.Email);

        var validationResult = await _createValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            return BadRequest(CreateValidationProblemDetails(validationResult));
        }

        try
        {
            var result = await _mediator.Send(command);
            var response = new CreateLandlordInvitationResponse(result.InvitationId, result.Message);

            return CreatedAtAction(
                nameof(CreateLandlordInvitation),
                new { id = result.InvitationId },
                response);
        }
        catch (ValidationException ex)
        {
            // Mirrors InvitationsController.CreateInvitation — handler-thrown FluentValidation
            // exceptions are surfaced as 400 ValidationProblemDetails (global middleware does
            // not auto-map these).
            return BadRequest(CreateValidationProblemDetails(ex));
        }
    }

    private static ProblemDetails CreateValidationProblemDetails(FluentValidation.Results.ValidationResult result)
    {
        var errors = result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation Error",
            Type = "https://tools.ietf.org/html/rfc7807"
        };
    }

    private static ProblemDetails CreateValidationProblemDetails(ValidationException ex)
    {
        var errors = ex.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation Error",
            Type = "https://tools.ietf.org/html/rfc7807"
        };
    }
}

// DTOs at bottom of file per project convention.
public record CreateLandlordInvitationRequest(string Email);
public record CreateLandlordInvitationResponse(Guid InvitationId, string Message);
