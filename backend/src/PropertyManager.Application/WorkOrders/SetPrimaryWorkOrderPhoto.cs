using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Command to set a photo as the primary photo for a work order.
/// Clears previous primary photo.
/// </summary>
public record SetPrimaryWorkOrderPhotoCommand(
    Guid WorkOrderId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for SetPrimaryWorkOrderPhotoCommand.
/// Sets the specified photo as primary, clearing previous primary.
/// </summary>
public class SetPrimaryWorkOrderPhotoHandler : IRequestHandler<SetPrimaryWorkOrderPhotoCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public SetPrimaryWorkOrderPhotoHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        SetPrimaryWorkOrderPhotoCommand request,
        CancellationToken cancellationToken)
    {
        // Find the photo and verify it belongs to user's account
        var photo = await _dbContext.WorkOrderPhotos
            .FirstOrDefaultAsync(wp => wp.Id == request.PhotoId
                && wp.WorkOrderId == request.WorkOrderId
                && wp.AccountId == _currentUser.AccountId, cancellationToken);

        if (photo == null)
        {
            throw new NotFoundException(nameof(WorkOrderPhoto), request.PhotoId);
        }

        // If already primary, nothing to do
        if (photo.IsPrimary)
        {
            return;
        }

        // Clear previous primary photo first (must save separately to avoid unique constraint violation)
        var currentPrimary = await _dbContext.WorkOrderPhotos
            .FirstOrDefaultAsync(wp => wp.WorkOrderId == request.WorkOrderId
                && wp.IsPrimary
                && wp.AccountId == _currentUser.AccountId, cancellationToken);

        if (currentPrimary != null)
        {
            currentPrimary.IsPrimary = false;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        // Set new primary
        photo.IsPrimary = true;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
