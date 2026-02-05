using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Command to delete a work order photo (AC #6).
/// Simpler than PropertyPhoto delete - no primary photo promotion logic.
/// </summary>
public record DeleteWorkOrderPhotoCommand(
    Guid WorkOrderId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for DeleteWorkOrderPhotoCommand.
/// Removes photo from S3 and DB.
/// </summary>
public class DeleteWorkOrderPhotoHandler : IRequestHandler<DeleteWorkOrderPhotoCommand>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public DeleteWorkOrderPhotoHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        DeleteWorkOrderPhotoCommand request,
        CancellationToken cancellationToken)
    {
        // Find the photo and verify it belongs to user's account
        var photo = await _dbContext.WorkOrderPhotos
            .FirstOrDefaultAsync(p => p.Id == request.PhotoId
                && p.WorkOrderId == request.WorkOrderId
                && p.AccountId == _currentUser.AccountId, cancellationToken);

        if (photo == null)
        {
            throw new NotFoundException(nameof(WorkOrderPhoto), request.PhotoId);
        }

        // Delete from S3
        await _photoService.DeletePhotoAsync(
            photo.StorageKey,
            photo.ThumbnailStorageKey,
            cancellationToken);

        // Delete from DB
        _dbContext.WorkOrderPhotos.Remove(photo);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
