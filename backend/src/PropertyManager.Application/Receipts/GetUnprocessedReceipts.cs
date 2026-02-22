using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Query to get all unprocessed receipts for the current user's account (AC-5.3.2, AC-5.3.4).
/// Unprocessed means ProcessedAt IS NULL.
/// </summary>
public record GetUnprocessedReceiptsQuery : IRequest<UnprocessedReceiptsResponse>;

/// <summary>
/// Response containing list of unprocessed receipts and total count.
/// </summary>
public record UnprocessedReceiptsResponse(
    IReadOnlyList<UnprocessedReceiptDto> Items,
    int TotalCount
);

/// <summary>
/// DTO for unprocessed receipt in queue display.
/// Includes property name (if assigned) and presigned view URL.
/// </summary>
public record UnprocessedReceiptDto(
    Guid Id,
    DateTime CreatedAt,
    Guid? PropertyId,
    string? PropertyName,
    string ContentType,
    string ViewUrl,
    string? ThumbnailUrl
);

/// <summary>
/// Handler for GetUnprocessedReceiptsQuery.
/// Returns all unprocessed receipts sorted by CreatedAt descending (newest first).
/// Tenant isolation is enforced via global query filter.
/// </summary>
public class GetUnprocessedReceiptsHandler : IRequestHandler<GetUnprocessedReceiptsQuery, UnprocessedReceiptsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly IStorageService _storageService;

    public GetUnprocessedReceiptsHandler(
        IAppDbContext dbContext,
        IStorageService storageService)
    {
        _dbContext = dbContext;
        _storageService = storageService;
    }

    public async Task<UnprocessedReceiptsResponse> Handle(
        GetUnprocessedReceiptsQuery request,
        CancellationToken cancellationToken)
    {
        // Query unprocessed receipts with property info
        var receipts = await _dbContext.Receipts
            .Include(r => r.Property)
            .Where(r => r.ProcessedAt == null)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

        // Generate presigned URLs in parallel for performance
        var urlTasks = receipts.Select(r =>
            _storageService.GeneratePresignedDownloadUrlAsync(r.StorageKey, cancellationToken));
        var urls = await Task.WhenAll(urlTasks);

        // Generate thumbnail presigned URLs for receipts that have thumbnails
        var thumbnailUrlTasks = receipts.Select(r =>
            r.ThumbnailStorageKey != null
                ? _storageService.GeneratePresignedDownloadUrlAsync(r.ThumbnailStorageKey, cancellationToken)
                : Task.FromResult<string?>(null));
        var thumbnailUrls = await Task.WhenAll(thumbnailUrlTasks);

        // Map to DTOs with presigned URLs
        var items = receipts.Select((receipt, index) => new UnprocessedReceiptDto(
            Id: receipt.Id,
            CreatedAt: receipt.CreatedAt,
            PropertyId: receipt.PropertyId,
            PropertyName: receipt.Property?.Name,
            ContentType: receipt.ContentType ?? "application/octet-stream",
            ViewUrl: urls[index],
            ThumbnailUrl: thumbnailUrls[index]
        )).ToList();

        return new UnprocessedReceiptsResponse(items, items.Count);
    }
}
