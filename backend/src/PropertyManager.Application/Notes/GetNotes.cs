using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Notes;

/// <summary>
/// Query for retrieving notes for a specific entity (AC #4).
/// </summary>
public record GetNotesQuery(
    string EntityType,
    Guid EntityId
) : IRequest<GetNotesResult>;

/// <summary>
/// Result containing notes and total count (AC #4).
/// </summary>
public record GetNotesResult(
    IReadOnlyList<NoteDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetNotesQuery (AC #4, #8).
/// Returns notes filtered by entity type and ID, with tenant isolation.
/// Notes are sorted by CreatedAt DESC (newest first).
/// </summary>
public class GetNotesQueryHandler : IRequestHandler<GetNotesQuery, GetNotesResult>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetNotesQueryHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetNotesResult> Handle(GetNotesQuery request, CancellationToken cancellationToken)
    {
        // Query notes with tenant isolation and soft delete filtering
        // Global query filter handles AccountId and DeletedAt filtering
        var notes = await _dbContext.Notes
            .Where(n => n.AccountId == _currentUser.AccountId)
            .Where(n => n.DeletedAt == null)
            .Where(n => n.EntityType == request.EntityType)
            .Where(n => n.EntityId == request.EntityId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NoteDto(
                n.Id,
                n.EntityType,
                n.EntityId,
                n.Content,
                n.CreatedByUserId,
                "User", // Placeholder - will be resolved via join or separate lookup
                n.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return new GetNotesResult(notes, notes.Count);
    }
}
