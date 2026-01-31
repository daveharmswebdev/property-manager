using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Notes;

/// <summary>
/// Command for updating a note (Story 10-3a, AC #3).
/// </summary>
public record UpdateNoteCommand(Guid Id, string Content) : IRequest;

/// <summary>
/// Validator for UpdateNoteCommand (Story 10-3a, AC #6).
/// Validates content is not empty.
/// </summary>
public class UpdateNoteCommandValidator : AbstractValidator<UpdateNoteCommand>
{
    public UpdateNoteCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Note ID is required");

        RuleFor(x => x.Content)
            .NotEmpty()
            .WithMessage("Note cannot be empty");
    }
}

/// <summary>
/// Handler for UpdateNoteCommand (Story 10-3a, AC #3).
/// Updates note content and sets UpdatedAt timestamp.
/// Only note owner (within same account) can update.
/// </summary>
public class UpdateNoteCommandHandler : IRequestHandler<UpdateNoteCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public UpdateNoteCommandHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateNoteCommand request, CancellationToken cancellationToken)
    {
        // Find note with tenant isolation and soft-delete check
        var note = await _dbContext.Notes
            .Where(n => n.Id == request.Id && n.AccountId == _currentUser.AccountId && n.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (note == null)
        {
            throw new NotFoundException(nameof(Note), request.Id);
        }

        // Update content and timestamp (AC #3, #4)
        note.Content = request.Content.Trim();
        note.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
