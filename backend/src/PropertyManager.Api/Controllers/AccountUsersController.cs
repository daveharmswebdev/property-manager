using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Application.AccountUsers;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Account user management endpoints (AC: 19.4).
/// Restricted to account Owners via CanManageUsers policy.
/// </summary>
[ApiController]
[Route("api/v1/account/users")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
[Authorize(Policy = "CanManageUsers")]
public class AccountUsersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<UpdateUserRoleCommand> _updateRoleValidator;
    private readonly ILogger<AccountUsersController> _logger;

    public AccountUsersController(
        IMediator mediator,
        IValidator<UpdateUserRoleCommand> updateRoleValidator,
        ILogger<AccountUsersController> logger)
    {
        _mediator = mediator;
        _updateRoleValidator = updateRoleValidator;
        _logger = logger;
    }

    /// <summary>
    /// Get all users in the current account.
    /// </summary>
    /// <response code="200">List of account users</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (not an Owner)</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetAccountUsersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAccountUsers()
    {
        var result = await _mediator.Send(new GetAccountUsersQuery());
        return Ok(result);
    }

    /// <summary>
    /// Update a user's role within the account.
    /// </summary>
    /// <param name="userId">The user ID to update</param>
    /// <param name="request">The new role</param>
    /// <response code="204">Role updated successfully</response>
    /// <response code="400">Validation error or last-owner guard</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (not an Owner)</response>
    /// <response code="404">User not found in account</response>
    [HttpPut("{userId:guid}/role")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUserRole([FromRoute] Guid userId, [FromBody] UpdateUserRoleRequest request)
    {
        var command = new UpdateUserRoleCommand(userId, request.Role);

        var validationResult = await _updateRoleValidator.ValidateAsync(command);
        if (!validationResult.IsValid)
        {
            return BadRequest(CreateValidationProblemDetails(validationResult));
        }

        await _mediator.Send(command);

        _logger.LogInformation("Updated role for user {UserId} to {Role}", userId, request.Role);
        return NoContent();
    }

    /// <summary>
    /// Remove (disable) a user from the account.
    /// </summary>
    /// <param name="userId">The user ID to remove</param>
    /// <response code="204">User removed successfully</response>
    /// <response code="400">Last-owner guard triggered</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not authorized (not an Owner)</response>
    /// <response code="404">User not found in account</response>
    [HttpDelete("{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveUser([FromRoute] Guid userId)
    {
        await _mediator.Send(new RemoveAccountUserCommand(userId));

        _logger.LogInformation("Removed user {UserId} from account", userId);
        return NoContent();
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
}

// DTOs
public record UpdateUserRoleRequest(string Role);
