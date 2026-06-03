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
    private readonly IValidator<ResendLandlordInvitationCommand> _resendValidator;
    private readonly ILogger<AdminLandlordInvitationsController> _logger;

    public AdminLandlordInvitationsController(
        IMediator mediator,
        IValidator<CreateLandlordInvitationCommand> createValidator,
        IValidator<ResendLandlordInvitationCommand> resendValidator,
        ILogger<AdminLandlordInvitationsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _resendValidator = resendValidator;
        _logger = logger;
    }

    /// <summary>
    /// List all landlord invitations (those with AccountId == null), newest first.
    /// </summary>
    /// <returns>The landlord invitations with their derived status and inviting admin.</returns>
    /// <response code="200">The list of landlord invitations.</response>
    /// <response code="401">If not authenticated.</response>
    /// <response code="403">If caller lacks the PlatformAdmin claim.</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetLandlordInvitationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetLandlordInvitations()
    {
        var result = await _mediator.Send(new GetLandlordInvitationsQuery());
        return Ok(result);
    }

    /// <summary>
    /// Resend an expired landlord invitation — creates a fresh invitation (AccountId == null,
    /// Role == "Owner") with a new code/expiry and sends the landlord-flavored email.
    /// </summary>
    /// <param name="id">The ID of the expired landlord invitation to resend.</param>
    /// <returns>The new invitation ID on success.</returns>
    /// <response code="201">Invitation resent successfully.</response>
    /// <response code="400">If the invitation is not expired or already used.</response>
    /// <response code="401">If not authenticated.</response>
    /// <response code="403">If caller lacks the PlatformAdmin claim.</response>
    /// <response code="404">If no landlord invitation matches the ID.</response>
    [HttpPost("{id:guid}/resend")]
    [ProducesResponseType(typeof(ResendLandlordInvitationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResendLandlordInvitation([FromRoute] Guid id)
    {
        var command = new ResendLandlordInvitationCommand(id);

        var validationResult = await _resendValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            return BadRequest(CreateValidationProblemDetails(validationResult));
        }

        try
        {
            var result = await _mediator.Send(command);
            var response = new ResendLandlordInvitationResponse(result.InvitationId, result.Message);

            return CreatedAtAction(
                nameof(ResendLandlordInvitation),
                new { id = result.InvitationId },
                response);
        }
        catch (ValidationException ex)
        {
            // Handler-thrown FluentValidation exceptions (not-expired / already-used) → 400.
            return BadRequest(CreateValidationProblemDetails(ex));
        }
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
public record ResendLandlordInvitationResponse(Guid InvitationId, string Message);
