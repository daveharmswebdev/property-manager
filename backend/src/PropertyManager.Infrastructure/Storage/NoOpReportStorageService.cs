using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// No-op implementation of IReportStorageService for local development and CI environments.
/// Logs operations but does not persist to external storage.
/// </summary>
public class NoOpReportStorageService : IReportStorageService
{
    private readonly ILogger<NoOpReportStorageService> _logger;

    public NoOpReportStorageService(ILogger<NoOpReportStorageService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task<string> SaveReportAsync(
        byte[] content,
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "NoOp: Would save report to {StorageKey} ({ContentLength} bytes)",
            storageKey,
            content.Length);

        return Task.FromResult(storageKey);
    }

    /// <inheritdoc />
    public Task<byte[]> GetReportAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "NoOp: Cannot retrieve report {StorageKey} - storage not configured",
            storageKey);

        throw new InvalidOperationException(
            "Report storage not configured. Cannot retrieve stored reports.");
    }

    /// <inheritdoc />
    public Task DeleteReportAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "NoOp: Would delete report {StorageKey}",
            storageKey);

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public string GenerateStorageKey(Guid accountId, int year, string filename)
    {
        return $"reports/{accountId}/{year}/{filename}";
    }
}
