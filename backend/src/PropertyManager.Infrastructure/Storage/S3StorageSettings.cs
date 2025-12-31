namespace PropertyManager.Infrastructure.Storage;

/// <summary>
/// Configuration settings for AWS S3 storage.
/// Bound from appsettings.json "AWS" section.
/// </summary>
public class S3StorageSettings
{
    public const string SectionName = "AWS";

    /// <summary>
    /// AWS access key ID for S3 operations.
    /// </summary>
    public string AccessKeyId { get; set; } = string.Empty;

    /// <summary>
    /// AWS secret access key for S3 operations.
    /// </summary>
    public string SecretAccessKey { get; set; } = string.Empty;

    /// <summary>
    /// The S3 bucket name for receipt storage.
    /// </summary>
    public string BucketName { get; set; } = string.Empty;

    /// <summary>
    /// AWS region for the S3 bucket (e.g., "us-east-1").
    /// </summary>
    public string Region { get; set; } = "us-east-1";

    /// <summary>
    /// Duration in minutes for presigned URL validity.
    /// Default is 60 minutes.
    /// </summary>
    public int PresignedUrlExpiryMinutes { get; set; } = 60;
}
