namespace PropertyManager.Domain.Enums;

/// <summary>
/// Status of a maintenance request through its lifecycle.
/// Stored as string in database per Architecture ADR #19.
/// </summary>
public enum MaintenanceRequestStatus
{
    /// <summary>
    /// Initial state when a tenant submits a maintenance request.
    /// </summary>
    Submitted,

    /// <summary>
    /// Request is being actively worked on (transitioned by landlord).
    /// </summary>
    InProgress,

    /// <summary>
    /// Work is finished and the issue has been resolved.
    /// </summary>
    Resolved,

    /// <summary>
    /// Request was reviewed and dismissed by the landlord (requires a reason).
    /// </summary>
    Dismissed
}
