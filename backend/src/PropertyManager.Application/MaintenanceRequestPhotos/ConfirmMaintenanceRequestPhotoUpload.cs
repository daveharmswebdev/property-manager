using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequestPhotos;

/// <summary>
/// Response model for confirmed maintenance request photo upload.
/// </summary>
public record ConfirmMaintenanceRequestPhotoUploadResponse(
    Guid Id,
    string? ThumbnailUrl,
    string? ViewUrl);

/// <summary>
/// Command to confirm a maintenance request photo upload and create MaintenanceRequestPhoto record.
/// Auto-sets IsPrimary=true if this is the first photo for the maintenance request.
/// </summary>
public record ConfirmMaintenanceRequestPhotoUploadCommand(
    Guid MaintenanceRequestId,
    string StorageKey,
    string ThumbnailStorageKey,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<ConfirmMaintenanceRequestPhotoUploadResponse>;

/// <summary>
/// Handler for ConfirmMaintenanceRequestPhotoUploadCommand.
/// Creates MaintenanceRequestPhoto record with auto-primary logic for first photo.
/// </summary>
public class ConfirmMaintenanceRequestPhotoUploadHandler : IRequestHandler<ConfirmMaintenanceRequestPhotoUploadCommand, ConfirmMaintenanceRequestPhotoUploadResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ConfirmMaintenanceRequestPhotoUploadHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<ConfirmMaintenanceRequestPhotoUploadResponse> Handle(
        ConfirmMaintenanceRequestPhotoUploadCommand request,
        CancellationToken cancellationToken)
    {
        // Verify maintenance request exists and belongs to user's account
        var maintenanceRequest = await _dbContext.MaintenanceRequests
            .Where(mr => mr.Id == request.MaintenanceRequestId
                && mr.AccountId == _currentUser.AccountId
                && mr.DeletedAt == null)
            .Select(mr => new { mr.Id, mr.PropertyId })
            .FirstOrDefaultAsync(cancellationToken);

        if (maintenanceRequest is null)
        {
            throw new NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId);
        }

        // Tenant users can only access requests on their assigned property
        if (_currentUser.Role == "Tenant" && _currentUser.PropertyId.HasValue
            && maintenanceRequest.PropertyId != _currentUser.PropertyId.Value)
        {
            throw new NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId);
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

        // Check if this is the first photo for the maintenance request (auto-primary logic)
        var existingPhotoCount = await _dbContext.MaintenanceRequestPhotos
            .CountAsync(p => p.MaintenanceRequestId == request.MaintenanceRequestId, cancellationToken);

        var isFirstPhoto = existingPhotoCount == 0;

        // Determine DisplayOrder (next in sequence)
        var maxDisplayOrder = await _dbContext.MaintenanceRequestPhotos
            .Where(p => p.MaintenanceRequestId == request.MaintenanceRequestId)
            .MaxAsync(p => (int?)p.DisplayOrder, cancellationToken) ?? -1;

        var photo = new MaintenanceRequestPhoto
        {
            AccountId = _currentUser.AccountId,
            MaintenanceRequestId = request.MaintenanceRequestId,
            StorageKey = photoRecord.StorageKey,
            ThumbnailStorageKey = photoRecord.ThumbnailStorageKey,
            OriginalFileName = request.OriginalFileName,
            ContentType = photoRecord.ContentType,
            FileSizeBytes = photoRecord.FileSizeBytes,
            DisplayOrder = maxDisplayOrder + 1,
            IsPrimary = isFirstPhoto,
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.MaintenanceRequestPhotos.Add(photo);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Generate presigned URLs for response
        string? thumbnailUrl = null;
        string? viewUrl = null;

        if (!string.IsNullOrEmpty(photo.ThumbnailStorageKey))
        {
            thumbnailUrl = await _photoService.GetThumbnailUrlAsync(photo.ThumbnailStorageKey, cancellationToken);
        }

        viewUrl = await _photoService.GetPhotoUrlAsync(photo.StorageKey, cancellationToken);

        return new ConfirmMaintenanceRequestPhotoUploadResponse(
            Id: photo.Id,
            ThumbnailUrl: thumbnailUrl,
            ViewUrl: viewUrl);
    }
}
