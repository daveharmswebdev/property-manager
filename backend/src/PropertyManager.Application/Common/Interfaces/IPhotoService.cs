namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Supported entity types for photo storage.
/// </summary>
public enum PhotoEntityType
{
    Receipts,
    Properties,
    Vendors,
    Users
}

/// <summary>
/// Request to generate an upload URL for a photo.
/// </summary>
/// <param name="EntityType">Type of entity the photo belongs to.</param>
/// <param name="EntityId">ID of the entity.</param>
/// <param name="ContentType">MIME type of the photo (e.g., image/jpeg).</param>
/// <param name="FileSizeBytes">Size of the file in bytes.</param>
/// <param name="OriginalFileName">Original file name for reference.</param>
public record PhotoUploadRequest(
    PhotoEntityType EntityType,
    Guid EntityId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName);

/// <summary>
/// Result of generating a photo upload URL.
/// </summary>
/// <param name="UploadUrl">Presigned URL for uploading the photo.</param>
/// <param name="StorageKey">Storage key where the photo will be stored.</param>
/// <param name="ThumbnailStorageKey">Storage key where the thumbnail will be stored.</param>
/// <param name="ExpiresAt">When the upload URL expires.</param>
public record PhotoUploadResult(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

/// <summary>
/// Request to confirm a photo upload and generate thumbnail.
/// </summary>
/// <param name="StorageKey">Storage key of the uploaded photo.</param>
/// <param name="ThumbnailStorageKey">Storage key where thumbnail should be stored.</param>
public record ConfirmPhotoUploadRequest(
    string StorageKey,
    string ThumbnailStorageKey);

/// <summary>
/// Record of a stored photo with its thumbnail.
/// </summary>
/// <param name="StorageKey">Storage key of the original photo.</param>
/// <param name="ThumbnailStorageKey">Storage key of the thumbnail (null if generation failed).</param>
/// <param name="ContentType">MIME type of the original photo.</param>
/// <param name="FileSizeBytes">Size of the original file in bytes.</param>
public record PhotoRecord(
    string StorageKey,
    string? ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes);

/// <summary>
/// Interface for generic photo storage operations with thumbnail support.
/// Implementations handle storage key generation, thumbnail creation, and presigned URL generation.
/// </summary>
public interface IPhotoService
{
    /// <summary>
    /// Generates a presigned URL for uploading a photo and calculates storage keys.
    /// Storage key pattern: {accountId}/{entityType}/{year}/{guid}.{ext}
    /// </summary>
    /// <param name="accountId">Account ID for tenant isolation.</param>
    /// <param name="request">Upload request details.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Upload URL and storage keys.</returns>
    Task<PhotoUploadResult> GenerateUploadUrlAsync(
        Guid accountId,
        PhotoUploadRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms a photo upload by downloading the original, generating a thumbnail,
    /// and uploading the thumbnail to storage.
    /// </summary>
    /// <param name="request">Confirmation request with storage keys.</param>
    /// <param name="contentType">Content type of the original photo.</param>
    /// <param name="fileSizeBytes">Size of the original file.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Photo record with storage information.</returns>
    Task<PhotoRecord> ConfirmUploadAsync(
        ConfirmPhotoUploadRequest request,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a presigned URL for viewing the original photo.
    /// </summary>
    /// <param name="storageKey">Storage key of the photo.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Presigned download URL.</returns>
    Task<string> GetPhotoUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a presigned URL for viewing the thumbnail.
    /// </summary>
    /// <param name="thumbnailStorageKey">Storage key of the thumbnail.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Presigned download URL.</returns>
    Task<string> GetThumbnailUrlAsync(
        string thumbnailStorageKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes both the original photo and its thumbnail from storage.
    /// </summary>
    /// <param name="storageKey">Storage key of the original photo.</param>
    /// <param name="thumbnailStorageKey">Storage key of the thumbnail (optional).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task DeletePhotoAsync(
        string storageKey,
        string? thumbnailStorageKey,
        CancellationToken cancellationToken = default);
}
