namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for cloud storage operations.
/// Implementation in Infrastructure layer (S3StorageService).
/// </summary>
public interface IStorageService
{
    /// <summary>
    /// Generates a presigned URL for uploading a file directly to storage.
    /// </summary>
    /// <param name="storageKey">The storage key (path) where the file will be stored.</param>
    /// <param name="contentType">The MIME type of the file being uploaded.</param>
    /// <param name="fileSizeBytes">The size of the file in bytes.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The presigned upload URL and expiration time.</returns>
    Task<UploadUrlResult> GeneratePresignedUploadUrlAsync(
        string storageKey,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a presigned URL for downloading/viewing a file from storage.
    /// </summary>
    /// <param name="storageKey">The storage key (path) of the file.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The presigned download URL.</returns>
    Task<string> GeneratePresignedDownloadUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a file from storage.
    /// </summary>
    /// <param name="storageKey">The storage key (path) of the file to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task DeleteFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of generating a presigned upload URL.
/// </summary>
/// <param name="Url">The presigned URL for uploading.</param>
/// <param name="ExpiresAt">When the presigned URL expires.</param>
public record UploadUrlResult(string Url, DateTime ExpiresAt);
