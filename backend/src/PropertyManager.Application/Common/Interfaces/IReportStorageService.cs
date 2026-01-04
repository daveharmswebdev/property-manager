namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for report storage operations.
/// Handles server-side upload/download of generated reports to S3.
/// </summary>
public interface IReportStorageService
{
    /// <summary>
    /// Saves report content to storage.
    /// </summary>
    /// <param name="content">The report bytes to save.</param>
    /// <param name="storageKey">The storage key (path) where the file will be stored.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The storage key of the saved report.</returns>
    Task<string> SaveReportAsync(
        byte[] content,
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets report content from storage.
    /// </summary>
    /// <param name="storageKey">The storage key (path) of the report.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The report bytes.</returns>
    Task<byte[]> GetReportAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a report from storage.
    /// </summary>
    /// <param name="storageKey">The storage key (path) of the report to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task DeleteReportAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a storage key for a report.
    /// </summary>
    /// <param name="accountId">The account ID.</param>
    /// <param name="year">The tax year.</param>
    /// <param name="filename">The filename with extension.</param>
    /// <returns>The full storage key path.</returns>
    string GenerateStorageKey(Guid accountId, int year, string filename);
}
