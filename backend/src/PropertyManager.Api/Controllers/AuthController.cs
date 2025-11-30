using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.Auth;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Authentication endpoints for registration and email verification.
/// </summary>
[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<RegisterCommand> _registerValidator;

    public AuthController(
        IMediator mediator,
        IValidator<RegisterCommand> registerValidator)
    {
        _mediator = mediator;
        _registerValidator = registerValidator;
    }

/// <summary>
    /// Register a new user account.
    /// Creates an Account with the provided name and a User with "Owner" role.
    /// Sends verification email to the provided address.
    /// </summary>
    /// <param name="request">Registration details</param>
    /// <returns>User ID on success</returns>
    /// <response code="201">Returns the newly created user's ID</response>
    /// <response code="400">If validation fails or email already exists</response>
    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var command = new RegisterCommand(request.Email, request.Password, request.Name);

        // Validate command
        var validationResult = await _registerValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            var problemDetails = CreateValidationProblemDetails(validationResult);
            return BadRequest(problemDetails);
        }

        try
        {
            var result = await _mediator.Send(command);
            var response = new RegisterResponse(result.UserId);

            return CreatedAtAction(
                nameof(Register),
                new { userId = result.UserId },
                response);
        }
        catch (ValidationException ex)
        {
            var problemDetails = CreateValidationProblemDetails(ex);
            return BadRequest(problemDetails);
        }
    }

    /// <summary>
    /// Verify email address using the token from verification email.
    /// </summary>
    /// <param name="request">Verification token</param>
    /// <returns>204 No Content on success</returns>
    /// <response code="204">Email verified successfully</response>
    /// <response code="400">If token is invalid, expired, or already used</response>
    [HttpPost("verify-email")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(CreateProblemDetails("Invalid verification link"));
        }

        var command = new VerifyEmailCommand(request.Token);
        var result = await _mediator.Send(command);

        if (result.Success)
        {
            return NoContent();
        }

        return BadRequest(CreateProblemDetails(result.ErrorMessage ?? "Invalid verification link"));
    }

    private ProblemDetails CreateProblemDetails(string detail)
    {
        return new ProblemDetails
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = "Bad Request",
            Status = StatusCodes.Status400BadRequest,
            Detail = detail,
            Instance = HttpContext.Request.Path,
            Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
        };
    }

    private ValidationProblemDetails CreateValidationProblemDetails(FluentValidation.Results.ValidationResult validationResult)
    {
        var errors = validationResult.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = "One or more validation errors occurred.",
            Status = StatusCodes.Status400BadRequest,
            Instance = HttpContext.Request.Path,
            Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
        };
    }

    private ValidationProblemDetails CreateValidationProblemDetails(ValidationException ex)
    {
        var errors = ex.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = "One or more validation errors occurred.",
            Status = StatusCodes.Status400BadRequest,
            Instance = HttpContext.Request.Path,
            Extensions = { ["traceId"] = HttpContext.TraceIdentifier }
        };
    }
}

/// <summary>
/// Request model for user registration.
/// </summary>
public record RegisterRequest(
    string Email,
    string Password,
    string Name
);

/// <summary>
/// Response model for successful registration.
/// </summary>
public record RegisterResponse(
    Guid UserId
);

/// <summary>
/// Request model for email verification.
/// </summary>
public record VerifyEmailRequest(
    string Token
);
