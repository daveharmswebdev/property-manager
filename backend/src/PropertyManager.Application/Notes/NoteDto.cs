namespace PropertyManager.Application.Notes;

/// <summary>
/// Data transfer object for Note entity (AC #4).
/// Includes CreatedByUserName for display purposes.
/// </summary>
public record NoteDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string Content,
    Guid CreatedByUserId,
    string CreatedByUserName,
    DateTime CreatedAt
);
