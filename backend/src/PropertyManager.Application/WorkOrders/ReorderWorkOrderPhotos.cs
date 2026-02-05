using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Command to reorder work order photos.
/// Updates DisplayOrder values based on provided photo ID sequence.
/// </summary>
public record ReorderWorkOrderPhotosCommand(
    Guid WorkOrderId,
    List<Guid> PhotoIds
) : IRequest;

/// <summary>
/// Handler for ReorderWorkOrderPhotosCommand.
/// Updates DisplayOrder values for photos based on array position.
/// </summary>
public class ReorderWorkOrderPhotosHandler : IRequestHandler<ReorderWorkOrderPhotosCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ReorderWorkOrderPhotosHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        ReorderWorkOrderPhotosCommand request,
        CancellationToken cancellationToken)
    {
        // Verify work order exists and belongs to user's account
        var workOrderExists = await _dbContext.WorkOrders
            .AnyAsync(w => w.Id == request.WorkOrderId && w.AccountId == _currentUser.AccountId, cancellationToken);

        if (!workOrderExists)
        {
            throw new NotFoundException(nameof(WorkOrder), request.WorkOrderId);
        }

        // Get all photos for the work order
        var photos = await _dbContext.WorkOrderPhotos
            .Where(wp => wp.WorkOrderId == request.WorkOrderId && wp.AccountId == _currentUser.AccountId)
            .ToListAsync(cancellationToken);

        // Validate all provided photo IDs belong to this work order
        var photoDict = photos.ToDictionary(p => p.Id);

        foreach (var photoId in request.PhotoIds)
        {
            if (!photoDict.ContainsKey(photoId))
            {
                throw new NotFoundException(nameof(WorkOrderPhoto), photoId);
            }
        }

        // Validate all photos are included in the reorder
        if (request.PhotoIds.Count != photos.Count || request.PhotoIds.Distinct().Count() != photos.Count)
        {
            throw new ValidationException("PhotoIds must contain all photos for the work order exactly once");
        }

        // Update DisplayOrder based on position in array
        for (int i = 0; i < request.PhotoIds.Count; i++)
        {
            var photo = photoDict[request.PhotoIds[i]];
            photo.DisplayOrder = i;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
