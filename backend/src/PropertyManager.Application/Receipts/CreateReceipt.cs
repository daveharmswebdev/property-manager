using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Command to confirm S3 upload and create receipt record (AC-5.1.3).
/// </summary>
public record CreateReceiptCommand(
    string StorageKey,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId = null
) : IRequest<Guid>;

/// <summary>
/// Handler for CreateReceiptCommand.
/// Creates a receipt record after client has uploaded to S3.
/// Generates thumbnail for images and PDFs.
/// Broadcasts SignalR notification after successful creation (AC-5.6.1).
/// </summary>
public class CreateReceiptHandler : IRequestHandler<CreateReceiptCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IReceiptNotificationService _notificationService;
    private readonly IReceiptThumbnailService _receiptThumbnailService;
    private readonly ILogger<CreateReceiptHandler> _logger;

    public CreateReceiptHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IReceiptNotificationService notificationService,
        IReceiptThumbnailService receiptThumbnailService,
        ILogger<CreateReceiptHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _notificationService = notificationService;
        _receiptThumbnailService = receiptThumbnailService;
        _logger = logger;
    }

    public async Task<Guid> Handle(
        CreateReceiptCommand request,
        CancellationToken cancellationToken)
    {
        // Validate property exists if provided (global query filter handles account isolation)
        string? propertyName = null;
        if (request.PropertyId.HasValue)
        {
            var property = await _dbContext.Properties
                .Where(p => p.Id == request.PropertyId.Value)
                .Select(p => new { p.Id, p.Name })
                .FirstOrDefaultAsync(cancellationToken);

            if (property == null)
            {
                throw new NotFoundException(nameof(Property), request.PropertyId.Value);
            }
            propertyName = property.Name;
        }

        var receipt = new Receipt
        {
            AccountId = _currentUser.AccountId,
            StorageKey = request.StorageKey,
            OriginalFileName = request.OriginalFileName,
            ContentType = request.ContentType,
            FileSizeBytes = request.FileSizeBytes,
            PropertyId = request.PropertyId,
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.Receipts.Add(receipt);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Generate thumbnail — failure does not affect receipt creation, but adds latency
        try
        {
            var thumbnailKey = await _receiptThumbnailService.GenerateThumbnailAsync(
                request.StorageKey,
                request.ContentType,
                cancellationToken);

            if (thumbnailKey != null)
            {
                receipt.ThumbnailStorageKey = thumbnailKey;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Thumbnail generation failed for receipt {ReceiptId}", receipt.Id);
        }

        // Broadcast real-time notification (AC-5.6.1)
        await _notificationService.NotifyReceiptAddedAsync(
            _currentUser.AccountId,
            new ReceiptAddedEvent(
                receipt.Id,
                null, // ThumbnailUrl - presigned URLs are generated on query, not stored
                receipt.PropertyId,
                propertyName,
                receipt.CreatedAt
            ),
            cancellationToken);

        return receipt.Id;
    }
}
