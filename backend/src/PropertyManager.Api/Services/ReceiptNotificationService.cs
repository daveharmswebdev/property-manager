using Microsoft.AspNetCore.SignalR;
using PropertyManager.Api.Hubs;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Api.Services;

/// <summary>
/// SignalR-based implementation of IReceiptNotificationService (AC-5.6.1, AC-5.6.2, AC-5.6.5).
/// Broadcasts receipt events to all users in an account group.
/// </summary>
public class ReceiptNotificationService : IReceiptNotificationService
{
    private readonly IHubContext<ReceiptHub> _hubContext;
    private readonly ILogger<ReceiptNotificationService> _logger;

    public ReceiptNotificationService(
        IHubContext<ReceiptHub> hubContext,
        ILogger<ReceiptNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task NotifyReceiptAddedAsync(
        Guid accountId,
        ReceiptAddedEvent receipt,
        CancellationToken ct = default)
    {
        var groupName = GetGroupName(accountId);
        _logger.LogInformation(
            "Broadcasting ReceiptAdded to group {GroupName} for receipt {ReceiptId}",
            groupName,
            receipt.Id);

        await _hubContext.Clients.Group(groupName)
            .SendAsync("ReceiptAdded", receipt, ct);
    }

    /// <inheritdoc />
    public async Task NotifyReceiptLinkedAsync(
        Guid accountId,
        ReceiptLinkedEvent receipt,
        CancellationToken ct = default)
    {
        var groupName = GetGroupName(accountId);
        _logger.LogInformation(
            "Broadcasting ReceiptLinked to group {GroupName} for receipt {ReceiptId}",
            groupName,
            receipt.ReceiptId);

        await _hubContext.Clients.Group(groupName)
            .SendAsync("ReceiptLinked", receipt, ct);
    }

    /// <inheritdoc />
    public async Task NotifyReceiptDeletedAsync(
        Guid accountId,
        Guid receiptId,
        CancellationToken ct = default)
    {
        var groupName = GetGroupName(accountId);
        _logger.LogInformation(
            "Broadcasting ReceiptDeleted to group {GroupName} for receipt {ReceiptId}",
            groupName,
            receiptId);

        await _hubContext.Clients.Group(groupName)
            .SendAsync("ReceiptDeleted", new { ReceiptId = receiptId }, ct);
    }

    private static string GetGroupName(Guid accountId) => $"account-{accountId}";
}
