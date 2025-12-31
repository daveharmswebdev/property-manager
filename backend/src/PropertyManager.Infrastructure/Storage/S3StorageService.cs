using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// AWS S3 implementation of IStorageService.
/// Generates presigned URLs for direct client-to-S3 uploads and downloads.
/// </summary>
public class S3StorageService : IStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly S3StorageSettings _settings;
    private readonly ILogger<S3StorageService> _logger;

    public S3StorageService(
        IOptions<S3StorageSettings> settings,
        ILogger<S3StorageService> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        var config = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(_settings.Region)
        };

        _s3Client = new AmazonS3Client(
            _settings.AccessKeyId,
            _settings.SecretAccessKey,
            config);
    }

    /// <inheritdoc />
    public Task<UploadUrlResult> GeneratePresignedUploadUrlAsync(
        string storageKey,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var expiresAt = DateTime.UtcNow.AddMinutes(_settings.PresignedUrlExpiryMinutes);
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _settings.BucketName,
                Key = storageKey,
                Verb = HttpVerb.PUT,
                ContentType = contentType,
                Expires = expiresAt
            };

            var url = _s3Client.GetPreSignedURL(request);

            _logger.LogInformation(
                "Generated presigned upload URL for key {StorageKey}, expires at {ExpiresAt}",
                storageKey,
                expiresAt);

            return Task.FromResult(new UploadUrlResult(url, expiresAt));
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex,
                "Failed to generate presigned upload URL for key {StorageKey}",
                storageKey);
            throw new InvalidOperationException(
                $"Failed to generate upload URL: {ex.Message}", ex);
        }
    }

    /// <inheritdoc />
    public Task<string> GeneratePresignedDownloadUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _settings.BucketName,
                Key = storageKey,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.AddMinutes(_settings.PresignedUrlExpiryMinutes)
            };

            var url = _s3Client.GetPreSignedURL(request);

            _logger.LogInformation(
                "Generated presigned download URL for key {StorageKey}",
                storageKey);

            return Task.FromResult(url);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex,
                "Failed to generate presigned download URL for key {StorageKey}",
                storageKey);
            throw new InvalidOperationException(
                $"Failed to generate download URL: {ex.Message}", ex);
        }
    }

    /// <inheritdoc />
    public async Task DeleteFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new DeleteObjectRequest
            {
                BucketName = _settings.BucketName,
                Key = storageKey
            };

            await _s3Client.DeleteObjectAsync(request, cancellationToken);

            _logger.LogInformation(
                "Deleted file with key {StorageKey} from S3",
                storageKey);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex,
                "Failed to delete file with key {StorageKey} from S3",
                storageKey);
            throw new InvalidOperationException(
                $"Failed to delete file: {ex.Message}", ex);
        }
    }
}
