namespace PropertyManager.Application.Notes;

/// <summary>
/// Data transfer object for Note entity (AC #4).
/// Includes CreatedByUserName for display purposes.
/// UpdatedAt enables "(edited)" annotation when UpdatedAt > CreatedAt (Story 10-3a, AC #4).
/// </summary>
public record NoteDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string Content,
    Guid CreatedByUserId,
    string CreatedByUserName,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
