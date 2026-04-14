using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequestPhotos;

/// <summary>
/// Response model containing presigned upload URL details for maintenance request photos.
/// </summary>
public record GenerateMaintenanceRequestPhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

/// <summary>
/// Command to generate a presigned upload URL for a maintenance request photo.
/// </summary>
public record GenerateMaintenanceRequestPhotoUploadUrlCommand(
    Guid MaintenanceRequestId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<GenerateMaintenanceRequestPhotoUploadUrlResponse>;

/// <summary>
/// Handler for GenerateMaintenanceRequestPhotoUploadUrlCommand.
/// Uses IPhotoService to generate presigned upload URL after verifying maintenance request ownership.
/// Tenant users can only access requests on their assigned property.
/// </summary>
public class GenerateMaintenanceRequestPhotoUploadUrlHandler : IRequestHandler<GenerateMaintenanceRequestPhotoUploadUrlCommand, GenerateMaintenanceRequestPhotoUploadUrlResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GenerateMaintenanceRequestPhotoUploadUrlHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GenerateMaintenanceRequestPhotoUploadUrlResponse> Handle(
        GenerateMaintenanceRequestPhotoUploadUrlCommand request,
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

        var photoRequest = new PhotoUploadRequest(
            PhotoEntityType.MaintenanceRequests,
            request.MaintenanceRequestId,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var result = await _photoService.GenerateUploadUrlAsync(
            _currentUser.AccountId,
            photoRequest,
            cancellationToken);

        return new GenerateMaintenanceRequestPhotoUploadUrlResponse(
            UploadUrl: result.UploadUrl,
            StorageKey: result.StorageKey,
            ThumbnailStorageKey: result.ThumbnailStorageKey,
            ExpiresAt: result.ExpiresAt);
    }
}
