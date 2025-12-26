using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Invitations;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Invitation endpoints for the invitation-only registration system (AC: TD.6.3, TD.6.6).
/// </summary>
[ApiController]
[Route("api/v1/invitations")]
[Produces("application/json")]
public class InvitationsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateInvitationCommand> _createValidator;
    private readonly IValidator<ValidateInvitationQuery> _validateValidator;
    private readonly IValidator<AcceptInvitationCommand> _acceptValidator;
    private readonly ILogger<InvitationsController> _logger;

    public InvitationsController(
        IMediator mediator,
        IValidator<CreateInvitationCommand> createValidator,
        IValidator<ValidateInvitationQuery> validateValidator,
        IValidator<AcceptInvitationCommand> acceptValidator,
        ILogger<InvitationsController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _validateValidator = validateValidator;
        _acceptValidator = acceptValidator;
        _logger = logger;
    }

    /// <summary>
    /// Create a new invitation and send email to recipient.
    /// Only authenticated users with Owner role can create invitations.
    /// </summary>
    /// <param name="request">Invitation details</param>
    /// <returns>Invitation ID on success</returns>
    /// <response code="201">Invitation created and email sent</response>
    /// <response code="400">If validation fails or email already registered/has pending invitation</response>
    /// <response code="401">If not authenticated</response>
    /// <response code="403">If not an Owner</response>
    [HttpPost]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(typeof(CreateInvitationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateInvitation([FromBody] CreateInvitationRequest request)
    {
        var command = new CreateInvitationCommand(request.Email);

        var validationResult = await _createValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            return BadRequest(CreateValidationProblemDetails(validationResult));
        }

        try
        {
            var result = await _mediator.Send(command);
            var response = new CreateInvitationResponse(result.InvitationId, result.Message);

            return CreatedAtAction(
                nameof(CreateInvitation),
                new { id = result.InvitationId },
                response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(CreateValidationProblemDetails(ex));
        }
    }

    /// <summary>
    /// Validate an invitation code.
    /// Returns whether the code is valid and the associated email.
    /// </summary>
    /// <param name="code">The invitation code from the email</param>
    /// <returns>Validation result with email if valid</returns>
    /// <response code="200">Validation result</response>
    /// <response code="400">If code is missing</response>
    [HttpGet("{code}/validate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ValidateInvitationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidateInvitation([FromRoute] string code)
    {
        var query = new ValidateInvitationQuery(code);

        var validationResult = await _validateValidator.ValidateAsync(query);
        if (!validationResult.IsValid)
        {
            return BadRequest(CreateValidationProblemDetails(validationResult));
        }

        var result = await _mediator.Send(query);

        var response = new ValidateInvitationResponse(
            result.IsValid,
            result.Email,
            result.ErrorMessage);

        return Ok(response);
    }

    /// <summary>
    /// Accept an invitation and create a new account.
    /// Creates user with the email from the invitation and the provided password.
    /// </summary>
    /// <param name="code">The invitation code from the email</param>
    /// <param name="request">Account creation details (password)</param>
    /// <returns>User ID and email on success</returns>
    /// <response code="201">Account created successfully</response>
    /// <response code="400">If validation fails or invitation is invalid/expired/used</response>
    [HttpPost("{code}/accept")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AcceptInvitationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AcceptInvitation(
        [FromRoute] string code,
        [FromBody] AcceptInvitationRequest request)
    {
        var command = new AcceptInvitationCommand(code, request.Password);

        var validationResult = await _acceptValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            return BadRequest(CreateValidationProblemDetails(validationResult));
        }

        try
        {
            var result = await _mediator.Send(command);
            var response = new AcceptInvitationResponse(
                result.UserId,
                result.Email,
                result.Message);

            return CreatedAtAction(
                nameof(AcceptInvitation),
                new { userId = result.UserId },
                response);
        }
        catch (ValidationException ex)
        {
            return BadRequest(CreateValidationProblemDetails(ex));
        }
    }

    private static ProblemDetails CreateValidationProblemDetails(FluentValidation.Results.ValidationResult result)
    {
        var errors = result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());

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
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation Error",
            Type = "https://tools.ietf.org/html/rfc7807"
        };
    }
}

// DTOs
public record CreateInvitationRequest(string Email);
public record CreateInvitationResponse(Guid InvitationId, string Message);

public record ValidateInvitationResponse(bool IsValid, string? Email, string? ErrorMessage);

public record AcceptInvitationRequest(string Password);
public record AcceptInvitationResponse(Guid UserId, string Email, string Message);
