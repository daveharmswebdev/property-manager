using MediatR;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Command to generate a presigned S3 upload URL for receipt upload (AC-5.1.1).
/// </summary>
public record GenerateUploadUrlCommand(
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId = null
) : IRequest<UploadUrlResponse>;

/// <summary>
/// Response containing presigned upload URL details (AC-5.1.1).
/// </summary>
public record UploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    DateTime ExpiresAt,
    string HttpMethod
);

/// <summary>
/// Handler for GenerateUploadUrlCommand.
/// Generates a presigned S3 PUT URL for direct client upload.
/// Storage key format: {accountId}/{year}/{guid}.{extension}
/// </summary>
public class GenerateUploadUrlHandler : IRequestHandler<GenerateUploadUrlCommand, UploadUrlResponse>
{
    private readonly IStorageService _storageService;
    private readonly ICurrentUser _currentUser;

    public GenerateUploadUrlHandler(
        IStorageService storageService,
        ICurrentUser currentUser)
    {
        _storageService = storageService;
        _currentUser = currentUser;
    }

    public async Task<UploadUrlResponse> Handle(
        GenerateUploadUrlCommand request,
        CancellationToken cancellationToken)
    {
        // Generate storage key: {accountId}/{year}/{guid}.{extension}
        var extension = GetExtensionFromContentType(request.ContentType);
        var storageKey = $"{_currentUser.AccountId}/{DateTime.UtcNow.Year}/{Guid.NewGuid()}.{extension}";

        var result = await _storageService.GeneratePresignedUploadUrlAsync(
            storageKey,
            request.ContentType,
            request.FileSizeBytes,
            cancellationToken);

        return new UploadUrlResponse(
            UploadUrl: result.Url,
            StorageKey: storageKey,
            ExpiresAt: result.ExpiresAt,
            HttpMethod: "PUT"
        );
    }

    private static string GetExtensionFromContentType(string contentType)
    {
        return contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "application/pdf" => "pdf",
            _ => "bin" // Fallback, but validator should prevent this
        };
    }
}
