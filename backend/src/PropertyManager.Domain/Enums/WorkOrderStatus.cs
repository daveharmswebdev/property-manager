namespace PropertyManager.Domain.Enums;

/// <summary>
/// Status of a work order through its lifecycle.
/// Stored as string in database per Architecture ADR #19.
/// </summary>
public enum WorkOrderStatus
{
    /// <summary>
    /// Initial state when work order is created.
    /// </summary>
    Reported,

    /// <summary>
    /// When vendor or DIY is assigned.
    /// </summary>
    Assigned,

    /// <summary>
    /// Work is finished.
    /// </summary>
    Completed
}
