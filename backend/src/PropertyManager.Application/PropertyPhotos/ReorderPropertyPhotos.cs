using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Command to reorder property photos (AC-13.3a.7).
/// Updates DisplayOrder values based on provided photo ID sequence.
/// </summary>
public record ReorderPropertyPhotosCommand(
    Guid PropertyId,
    List<Guid> PhotoIds
) : IRequest;

/// <summary>
/// Handler for ReorderPropertyPhotosCommand.
/// Updates DisplayOrder values for photos based on array position.
/// </summary>
public class ReorderPropertyPhotosHandler : IRequestHandler<ReorderPropertyPhotosCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ReorderPropertyPhotosHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        ReorderPropertyPhotosCommand request,
        CancellationToken cancellationToken)
    {
        // Verify property exists and belongs to user's account (AC-13.3a.10)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        // Get all photos for the property
        var photos = await _dbContext.PropertyPhotos
            .Where(pp => pp.PropertyId == request.PropertyId && pp.AccountId == _currentUser.AccountId)
            .ToListAsync(cancellationToken);

        // Validate all provided photo IDs belong to this property
        var photoDict = photos.ToDictionary(p => p.Id);

        foreach (var photoId in request.PhotoIds)
        {
            if (!photoDict.ContainsKey(photoId))
            {
                throw new NotFoundException(nameof(PropertyPhoto), photoId);
            }
        }

        // Validate all photos are included in the reorder
        if (request.PhotoIds.Count != photos.Count || request.PhotoIds.Distinct().Count() != photos.Count)
        {
            throw new ArgumentException("PhotoIds must contain all photos for the property exactly once");
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
