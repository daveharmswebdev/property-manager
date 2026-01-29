namespace PropertyManager.Api.Contracts.Notes;

/// <summary>
/// Request model for creating a note (AC #5).
/// </summary>
public record CreateNoteRequest(
    string EntityType,
    Guid EntityId,
    string Content
);
