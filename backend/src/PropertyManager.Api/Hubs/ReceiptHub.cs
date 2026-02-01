using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PropertyManager.Application.Common;

namespace PropertyManager.Api.Hubs;

/// <summary>
/// SignalR Hub for real-time receipt notifications (AC-5.6.1, AC-5.6.2, AC-5.6.5).
/// Users are grouped by account to ensure account-based isolation.
/// </summary>
[Authorize]
public class ReceiptHub : Hub
{
    private readonly ILogger<ReceiptHub> _logger;

    public ReceiptHub(ILogger<ReceiptHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Called when a client connects. Adds the user to their account group.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var accountId = Context.User?.FindFirst("accountId")?.Value;

        if (!string.IsNullOrEmpty(accountId))
        {
            var groupName = $"account-{accountId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation(
                "User connected to account {AccountId} with connection {ConnectionId}",
                LogSanitizer.MaskId(accountId),
                LogSanitizer.Sanitize(Context.ConnectionId));
        }
        else
        {
            _logger.LogWarning(
                "User connected without accountId claim. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
        }

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Called when a client disconnects. Removes the user from their account group.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var accountId = Context.User?.FindFirst("accountId")?.Value;

        if (!string.IsNullOrEmpty(accountId))
        {
            var groupName = $"account-{accountId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation(
                "User disconnected from account {AccountId}. ConnectionId: {ConnectionId}",
                LogSanitizer.MaskId(accountId),
                LogSanitizer.Sanitize(Context.ConnectionId));
        }

        if (exception != null)
        {
            _logger.LogWarning(exception,
                "Client disconnected with error. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
