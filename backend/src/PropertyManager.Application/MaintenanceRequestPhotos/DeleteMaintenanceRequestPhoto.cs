using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequestPhotos;

/// <summary>
/// Command to delete a maintenance request photo.
/// If deleted photo was primary, promotes next photo by DisplayOrder.
/// </summary>
public record DeleteMaintenanceRequestPhotoCommand(
    Guid MaintenanceRequestId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for DeleteMaintenanceRequestPhotoCommand.
/// Removes photo from S3 and DB, promotes next photo if deleted was primary.
/// </summary>
public class DeleteMaintenanceRequestPhotoHandler : IRequestHandler<DeleteMaintenanceRequestPhotoCommand>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public DeleteMaintenanceRequestPhotoHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        DeleteMaintenanceRequestPhotoCommand request,
        CancellationToken cancellationToken)
    {
        // Verify maintenance request exists and enforce tenant property scoping
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

        // Find the photo and verify it belongs to user's account
        var photo = await _dbContext.MaintenanceRequestPhotos
            .FirstOrDefaultAsync(p => p.Id == request.PhotoId
                && p.MaintenanceRequestId == request.MaintenanceRequestId
                && p.AccountId == _currentUser.AccountId, cancellationToken);

        if (photo == null)
        {
            throw new NotFoundException(nameof(MaintenanceRequestPhoto), request.PhotoId);
        }

        var wasPrimary = photo.IsPrimary;
        var maintenanceRequestId = photo.MaintenanceRequestId;

        // Delete from S3
        await _photoService.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            cancellationToken);

        // Delete from DB
        _dbContext.MaintenanceRequestPhotos.Remove(photo);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // If deleted photo was primary, promote next photo by DisplayOrder
        if (wasPrimary)
        {
            var nextPhoto = await _dbContext.MaintenanceRequestPhotos
                .Where(p => p.MaintenanceRequestId == maintenanceRequestId)
                .OrderBy(p => p.DisplayOrder)
                .FirstOrDefaultAsync(cancellationToken);

            if (nextPhoto != null)
            {
                nextPhoto.IsPrimary = true;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
