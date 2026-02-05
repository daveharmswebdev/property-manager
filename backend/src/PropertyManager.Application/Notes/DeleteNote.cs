using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Notes;

/// <summary>
/// Command for soft-deleting a note (AC #6).
/// Sets DeletedAt timestamp on note record.
/// </summary>
public record DeleteNoteCommand(Guid Id) : IRequest;

/// <summary>
/// Handler for DeleteNoteCommand (AC #6).
/// Soft-deletes the note by setting DeletedAt timestamp.
/// </summary>
public class DeleteNoteCommandHandler : IRequestHandler<DeleteNoteCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public DeleteNoteCommandHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(DeleteNoteCommand request, CancellationToken cancellationToken)
    {
        // Find note with tenant isolation and soft-delete check
        var note = await _dbContext.Notes
            .Where(n => n.Id == request.Id && n.AccountId == _currentUser.AccountId && n.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (note == null)
        {
            throw new NotFoundException(nameof(Note), request.Id);
        }

        // Soft delete - set DeletedAt timestamp (AC #6)
        note.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
