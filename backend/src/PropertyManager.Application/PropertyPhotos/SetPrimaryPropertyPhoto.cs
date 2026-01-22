using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.PropertyPhotos;

/// <summary>
/// Command to set a photo as the primary photo for a property (AC-13.3a.6).
/// Clears previous primary photo.
/// </summary>
public record SetPrimaryPropertyPhotoCommand(
    Guid PropertyId,
    Guid PhotoId
) : IRequest;

/// <summary>
/// Handler for SetPrimaryPropertyPhotoCommand.
/// Sets the specified photo as primary, clearing previous primary.
/// </summary>
public class SetPrimaryPropertyPhotoHandler : IRequestHandler<SetPrimaryPropertyPhotoCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public SetPrimaryPropertyPhotoHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(
        SetPrimaryPropertyPhotoCommand request,
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

        // If already primary, nothing to do
        if (photo.IsPrimary)
        {
            return;
        }

        // Clear previous primary photo first (must save separately to avoid unique constraint violation)
        var currentPrimary = await _dbContext.PropertyPhotos
            .FirstOrDefaultAsync(pp => pp.PropertyId == request.PropertyId
                && pp.IsPrimary
                && pp.AccountId == _currentUser.AccountId, cancellationToken);

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
