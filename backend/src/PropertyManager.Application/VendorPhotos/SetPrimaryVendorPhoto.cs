using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorPhotos;

/// <summary>
/// Command to set a photo as the primary photo for a vendor.
/// Clears previous primary photo.
/// </summary>
public record SetPrimaryVendorPhotoCommand(
    Guid VendorId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for SetPrimaryVendorPhotoCommand.
/// Sets the specified photo as primary, clearing previous primary.
/// </summary>
public class SetPrimaryVendorPhotoHandler : IRequestHandler<SetPrimaryVendorPhotoCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public SetPrimaryVendorPhotoHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        SetPrimaryVendorPhotoCommand request,
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

        // If already primary, nothing to do
        if (photo.IsPrimary)
        {
            return;
        }

        // Clear previous primary photo first (must save separately to avoid unique constraint violation)
        var currentPrimary = await _dbContext.VendorPhotos
            .FirstOrDefaultAsync(vp => vp.VendorId == request.VendorId
                && vp.IsPrimary
                && vp.AccountId == _currentUser.AccountId, cancellationToken);

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
