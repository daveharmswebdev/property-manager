using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyManager.Api.Contracts.Notes;
using PropertyManager.Application.Notes;

namespace PropertyManager.Api.Controllers;

/// <summary>
/// Notes management endpoints.
/// Supports polymorphic notes that can be attached to any entity (WorkOrder, Vendor, Property).
/// </summary>
[ApiController]
[Route("api/v1/notes")]
[Produces("application/json")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class NotesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IValidator<CreateNoteCommand> _createValidator;
    private readonly ILogger<NotesController> _logger;

    public NotesController(
        IMediator mediator,
        IValidator<CreateNoteCommand> createValidator,
        ILogger<NotesController> logger)
    {
        _mediator = mediator;
        _createValidator = createValidator;
        _logger = logger;
    }

    /// <summary>
    /// Get notes for a specific entity (AC #4).
    /// </summary>
    /// <param name="entityType">Entity type (WorkOrder, Vendor, Property)</param>
    /// <param name="entityId">Entity GUID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of notes for the entity</returns>
    /// <response code="200">Returns the list of notes</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(GetNotesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetNotes(
        [FromQuery] string entityType,
        [FromQuery] Guid entityId,
        CancellationToken cancellationToken)
    {
        var query = new GetNotesQuery(entityType, entityId);
        var result = await _mediator.Send(query, cancellationToken);

        _logger.LogInformation(
            "Retrieved {Count} notes for {EntityType}/{EntityId}",
            result.TotalCount, entityType, entityId);

        return Ok(result);
    }

    /// <summary>
    /// Create a new note (AC #5).
    /// </summary>
    /// <param name="request">Note details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The newly created note ID</returns>
    /// <response code="201">Returns the newly created note ID</response>
    /// <response code="400">If validation fails</response>
    /// <response code="401">If user is not authenticated</response>
    [HttpPost]
    [ProducesResponseType(typeof(CreateNoteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateNote(
        [FromBody] CreateNoteRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateNoteCommand(
            request.EntityType,
            request.EntityId,
            request.Content);

        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            return ValidationProblem(new ValidationProblemDetails(
                validationResult.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())));
        }

        var id = await _mediator.Send(command, cancellationToken);

        _logger.LogInformation(
            "Note created: {NoteId} for {EntityType}/{EntityId}",
            id, request.EntityType, request.EntityId);

        return CreatedAtAction(
            nameof(GetNotes),
            new { entityType = request.EntityType, entityId = request.EntityId },
            new CreateNoteResponse(id));
    }

    /// <summary>
    /// Delete a note (soft delete) (AC #6).
    /// </summary>
    /// <param name="id">Note GUID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <response code="204">Note deleted successfully</response>
    /// <response code="401">If user is not authenticated</response>
    /// <response code="404">If note not found</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteNote(Guid id, CancellationToken cancellationToken)
    {
        var command = new DeleteNoteCommand(id);
        await _mediator.Send(command, cancellationToken);

        _logger.LogInformation("Note deleted: {NoteId}", id);

        return NoContent();
    }
}
