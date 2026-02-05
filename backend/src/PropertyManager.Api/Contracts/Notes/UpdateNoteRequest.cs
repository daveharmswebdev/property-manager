namespace PropertyManager.Api.Contracts.Notes;

/// <summary>
/// Request model for updating a note (Story 10-3a, AC #3).
/// </summary>
public record UpdateNoteRequest(string Content);
