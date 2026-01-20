using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Command to delete a property photo (AC-13.3a.5).
/// If deleted photo was primary, promotes next photo by DisplayOrder.
/// </summary>
public record DeletePropertyPhotoCommand(
    Guid PropertyId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for DeletePropertyPhotoCommand.
/// Removes photo from S3 and DB, promotes next photo if deleted was primary.
/// </summary>
public class DeletePropertyPhotoHandler : IRequestHandler<DeletePropertyPhotoCommand>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public DeletePropertyPhotoHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        DeletePropertyPhotoCommand request,
        CancellationToken cancellationToken)
    {
        // Find the photo and verify it belongs to user's account (AC-13.3a.10)
        var photo = await _dbContext.PropertyPhotos
            .FirstOrDefaultAsync(pp => pp.Id == request.PhotoId
                && pp.PropertyId == request.PropertyId
                && pp.AccountId == _currentUser.AccountId, cancellationToken);

        if (photo == null)
        {
            throw new NotFoundException(nameof(PropertyPhoto), request.PhotoId);
        }

        var wasPrimary = photo.IsPrimary;
        var propertyId = photo.PropertyId;

        // Delete from S3
        await _photoService.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            cancellationToken);

        // Delete from DB
        _dbContext.PropertyPhotos.Remove(photo);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // If deleted photo was primary, promote next photo by DisplayOrder (AC-13.3a.5)
        if (wasPrimary)
        {
            var nextPhoto = await _dbContext.PropertyPhotos
                .Where(pp => pp.PropertyId == propertyId)
                .OrderBy(pp => pp.DisplayOrder)
                .FirstOrDefaultAsync(cancellationToken);

            if (nextPhoto != null)
            {
                nextPhoto.IsPrimary = true;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
