namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Service for broadcasting real-time receipt notifications via SignalR (AC-5.6.1, AC-5.6.2).
/// </summary>
public interface IReceiptNotificationService
{
    /// <summary>
    /// Notify all users in an account that a new receipt was added (AC-5.6.1).
    /// </summary>
    Task NotifyReceiptAddedAsync(Guid accountId, ReceiptAddedEvent receipt, CancellationToken ct = default);

    /// <summary>
    /// Notify all users in an account that a receipt was linked to an expense (AC-5.6.2).
    /// </summary>
    Task NotifyReceiptLinkedAsync(Guid accountId, ReceiptLinkedEvent receipt, CancellationToken ct = default);

    /// <summary>
    /// Notify all users in an account that a receipt was deleted.
    /// </summary>
    Task NotifyReceiptDeletedAsync(Guid accountId, Guid receiptId, CancellationToken ct = default);
}

/// <summary>
/// Event data for a newly added receipt (AC-5.6.1).
/// </summary>
public record ReceiptAddedEvent(
    Guid Id,
    string? ThumbnailUrl,
    Guid? PropertyId,
    string? PropertyName,
    DateTime CreatedAt
);

/// <summary>
/// Event data for a receipt linked to an expense (AC-5.6.2).
/// </summary>
public record ReceiptLinkedEvent(
    Guid ReceiptId,
    Guid ExpenseId
);
