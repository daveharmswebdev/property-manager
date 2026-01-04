using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// AWS S3 implementation of IReportStorageService.
/// Handles server-side upload/download of generated reports.
/// </summary>
public class ReportStorageService : IReportStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly S3StorageSettings _settings;
    private readonly ILogger<ReportStorageService> _logger;

    public ReportStorageService(
        IOptions<S3StorageSettings> settings,
        ILogger<ReportStorageService> logger)
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
    public async Task<string> SaveReportAsync(
        byte[] content,
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var stream = new MemoryStream(content);

            var contentType = storageKey.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)
                ? "application/zip"
                : "application/pdf";

            var putRequest = new PutObjectRequest
            {
                BucketName = _settings.BucketName,
                Key = storageKey,
                InputStream = stream,
                ContentType = contentType
            };

            await _s3Client.PutObjectAsync(putRequest, cancellationToken);

            _logger.LogInformation(
                "Saved report to S3: {StorageKey} ({ContentLength} bytes)",
                storageKey,
                content.Length);

            return storageKey;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex,
                "Failed to save report to S3: {StorageKey}",
                storageKey);
            throw new InvalidOperationException(
                $"Failed to save report: {ex.Message}", ex);
        }
    }

    /// <inheritdoc />
    public async Task<byte[]> GetReportAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var getRequest = new GetObjectRequest
            {
                BucketName = _settings.BucketName,
                Key = storageKey
            };

            using var response = await _s3Client.GetObjectAsync(getRequest, cancellationToken);
            using var memoryStream = new MemoryStream();
            await response.ResponseStream.CopyToAsync(memoryStream, cancellationToken);

            _logger.LogInformation(
                "Retrieved report from S3: {StorageKey} ({ContentLength} bytes)",
                storageKey,
                memoryStream.Length);

            return memoryStream.ToArray();
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning(
                "Report not found in S3: {StorageKey}",
                storageKey);
            throw new InvalidOperationException($"Report not found: {storageKey}");
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex,
                "Failed to retrieve report from S3: {StorageKey}",
                storageKey);
            throw new InvalidOperationException(
                $"Failed to retrieve report: {ex.Message}", ex);
        }
    }

    /// <inheritdoc />
    public async Task DeleteReportAsync(
        string storageKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = _settings.BucketName,
                Key = storageKey
            };

            await _s3Client.DeleteObjectAsync(deleteRequest, cancellationToken);

            _logger.LogInformation(
                "Deleted report from S3: {StorageKey}",
                storageKey);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex,
                "Failed to delete report from S3: {StorageKey}",
                storageKey);
            throw new InvalidOperationException(
                $"Failed to delete report: {ex.Message}", ex);
        }
    }

    /// <inheritdoc />
    public string GenerateStorageKey(Guid accountId, int year, string filename)
    {
        return $"reports/{accountId}/{year}/{filename}";
    }
}
