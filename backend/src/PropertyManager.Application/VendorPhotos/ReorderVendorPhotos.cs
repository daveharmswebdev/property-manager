using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Command to reorder vendor photos.
/// Updates DisplayOrder values based on provided photo ID sequence.
/// </summary>
public record ReorderVendorPhotosCommand(
    Guid VendorId,
    List<Guid> PhotoIds
) : IRequest;

/// <summary>
/// Handler for ReorderVendorPhotosCommand.
/// Updates DisplayOrder values for photos based on array position.
/// </summary>
public class ReorderVendorPhotosHandler : IRequestHandler<ReorderVendorPhotosCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public ReorderVendorPhotosHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        ReorderVendorPhotosCommand request,
        CancellationToken cancellationToken)
    {
        // Verify vendor exists and belongs to user's account
        var vendorExists = await _dbContext.Vendors
            .AnyAsync(v => v.Id == request.VendorId && v.AccountId == _currentUser.AccountId && v.DeletedAt == null, cancellationToken);

        if (!vendorExists)
        {
            throw new NotFoundException(nameof(Vendor), request.VendorId);
        }

        // Get all photos for the vendor
        var photos = await _dbContext.VendorPhotos
            .Where(vp => vp.VendorId == request.VendorId && vp.AccountId == _currentUser.AccountId)
            .ToListAsync(cancellationToken);

        // Validate all provided photo IDs belong to this vendor
        var photoDict = photos.ToDictionary(p => p.Id);

        foreach (var photoId in request.PhotoIds)
        {
            if (!photoDict.ContainsKey(photoId))
            {
                throw new NotFoundException(nameof(VendorPhoto), photoId);
            }
        }

        // Validate all photos are included in the reorder
        if (request.PhotoIds.Count != photos.Count || request.PhotoIds.Distinct().Count() != photos.Count)
        {
            throw new ArgumentException("PhotoIds must contain all photos for the vendor exactly once");
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
