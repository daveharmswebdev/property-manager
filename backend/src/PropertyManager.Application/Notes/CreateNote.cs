using FluentValidation;
using MediatR;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Notes;

/// <summary>
/// Command for creating a new note (AC #5).
/// </summary>
public record CreateNoteCommand(
    string EntityType,
    Guid EntityId,
    string Content
) : IRequest<Guid>;

/// <summary>
/// Validator for CreateNoteCommand (AC #7).
/// Validates content is not empty and entity type is valid.
/// </summary>
public class CreateNoteCommandValidator : AbstractValidator<CreateNoteCommand>
{
    public CreateNoteCommandValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty()
            .WithMessage("Content is required");

        RuleFor(x => x.EntityType)
            .NotEmpty()
            .WithMessage("EntityType is required")
            .Must(NoteEntityType.IsValid)
            .WithMessage($"EntityType must be one of: {string.Join(", ", NoteEntityType.ValidTypes)}");

        RuleFor(x => x.EntityId)
            .NotEmpty()
            .WithMessage("EntityId is required");
    }
}

/// <summary>
/// Handler for CreateNoteCommand (AC #5).
/// Creates a new note with AccountId and CreatedByUserId from current user.
/// </summary>
/// <remarks>
/// KNOWN LIMITATION: No validation that EntityId exists for the given EntityType.
/// Notes can be created for non-existent entities. This is a gap in the current
/// implementation - the PRD assumes notes are attached to existing entities.
/// Consider adding entity existence validation in a future story if orphaned
/// notes become problematic. The trade-off is that validation would require
/// checking different tables based on EntityType, adding coupling between
/// the Notes module and other entity modules.
/// </remarks>
public class CreateNoteCommandHandler : IRequestHandler<CreateNoteCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateNoteCommandHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateNoteCommand request, CancellationToken cancellationToken)
    {
        var note = new Note
        {
            Id = Guid.NewGuid(),
            AccountId = _currentUser.AccountId,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            Content = request.Content.Trim(),
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.Notes.Add(note);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return note.Id;
    }
}
