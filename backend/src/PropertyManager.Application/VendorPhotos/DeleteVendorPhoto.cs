using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Command to delete a vendor photo.
/// If deleted photo was primary, promotes next photo by DisplayOrder.
/// </summary>
public record DeleteVendorPhotoCommand(
    Guid VendorId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for DeleteVendorPhotoCommand.
/// Removes photo from S3 and DB, promotes next photo if deleted was primary.
/// </summary>
public class DeleteVendorPhotoHandler : IRequestHandler<DeleteVendorPhotoCommand>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public DeleteVendorPhotoHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        DeleteVendorPhotoCommand request,
        CancellationToken cancellationToken)
    {
        // Find the photo and verify it belongs to user's account
        var photo = await _dbContext.VendorPhotos
            .FirstOrDefaultAsync(vp => vp.Id == request.PhotoId
                && vp.VendorId == request.VendorId
                && vp.AccountId == _currentUser.AccountId, cancellationToken);

        if (photo == null)
        {
            throw new NotFoundException(nameof(VendorPhoto), request.PhotoId);
        }

        var wasPrimary = photo.IsPrimary;
        var vendorId = photo.VendorId;

        // Delete from S3
        await _photoService.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            cancellationToken);

        // Delete from DB
        _dbContext.VendorPhotos.Remove(photo);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // If deleted photo was primary, promote next photo by DisplayOrder
        if (wasPrimary)
        {
            var nextPhoto = await _dbContext.VendorPhotos
                .Where(vp => vp.VendorId == vendorId)
                .OrderBy(vp => vp.DisplayOrder)
                .FirstOrDefaultAsync(cancellationToken);

            if (nextPhoto != null)
            {
                nextPhoto.IsPrimary = true;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
