using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Response model for confirmed work order photo upload.
/// </summary>
public record ConfirmWorkOrderPhotoUploadResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

/// <summary>
/// Command to confirm a work order photo upload and create WorkOrderPhoto record (AC #4).
/// </summary>
public record ConfirmWorkOrderPhotoUploadCommand(
    Guid WorkOrderId,
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<ConfirmWorkOrderPhotoUploadResponse>;

/// <summary>
/// Handler for ConfirmWorkOrderPhotoUploadCommand.
/// Creates WorkOrderPhoto record after confirming upload with IPhotoService.
/// Simpler than PropertyPhoto - no primary photo or display order logic.
/// </summary>
public class ConfirmWorkOrderPhotoUploadHandler : IRequestHandler<ConfirmWorkOrderPhotoUploadCommand, ConfirmWorkOrderPhotoUploadResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ConfirmWorkOrderPhotoUploadHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<ConfirmWorkOrderPhotoUploadResponse> Handle(
        ConfirmWorkOrderPhotoUploadCommand request,
        CancellationToken cancellationToken)
    {
        // Verify work order exists and belongs to user's account
        var workOrderExists = await _dbContext.WorkOrders
            .AnyAsync(w => w.Id == request.WorkOrderId && w.AccountId == _currentUser.AccountId, cancellationToken);

        if (!workOrderExists)
        {
            throw new NotFoundException(nameof(WorkOrder), request.WorkOrderId);
        }

        // Validate storage key belongs to current user's account
        var keyParts = request.StorageKey.Split('/');
        if (keyParts.Length < 1 || !Guid.TryParse(keyParts[0], out var keyAccountId))
        {
            throw new ArgumentException("Invalid storage key format", nameof(request.StorageKey));
        }

        if (keyAccountId != _currentUser.AccountId)
        {
            throw new UnauthorizedAccessException("Cannot confirm upload for another account");
        }

        // Confirm upload and generate thumbnail via IPhotoService
        var confirmRequest = new ConfirmPhotoUploadRequest(
            request.StorageKey,
            request.ThumbnailStorageKey);

        var photoRecord = await _photoService.ConfirmUploadAsync(
            confirmRequest,
            request.ContentType,
            request.FileSizeBytes,
            cancellationToken);

        var workOrderPhoto = new WorkOrderPhoto
        {
            AccountId = _currentUser.AccountId,
            WorkOrderId = request.WorkOrderId,
            StorageKey = photoRecord.StorageKey,
            ThumbnailStorageKey = photoRecord.ThumbnailStorageKey,
            OriginalFileName = request.OriginalFileName,
            ContentType = photoRecord.ContentType,
            FileSizeBytes = photoRecord.FileSizeBytes,
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.WorkOrderPhotos.Add(workOrderPhoto);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Generate presigned URLs for response
        string? thumbnailUrl = null;
        string? viewUrl = null;

        if (!string.IsNullOrEmpty(workOrderPhoto.ThumbnailStorageKey))
        {
            thumbnailUrl = await _photoService.GetThumbnailUrlAsync(workOrderPhoto.ThumbnailStorageKey, cancellationToken);
        }

        viewUrl = await _photoService.GetPhotoUrlAsync(workOrderPhoto.StorageKey, cancellationToken);

        return new ConfirmWorkOrderPhotoUploadResponse(
            Id: workOrderPhoto.Id,
            ThumbnailUrl: thumbnailUrl,
            ViewUrl: viewUrl);
    }
}
