using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Response model containing presigned upload URL details for work order photos.
/// </summary>
public record GenerateWorkOrderPhotoUploadUrlResponse(
    string UploadUrl,
    string StorageKey,
    string ThumbnailStorageKey,
    DateTime ExpiresAt);

/// <summary>
/// Command to generate a presigned upload URL for a work order photo (AC #3).
/// </summary>
public record GenerateWorkOrderPhotoUploadUrlCommand(
    Guid WorkOrderId,
    string ContentType,
    long FileSizeBytes,
    string OriginalFileName
) : IRequest<GenerateWorkOrderPhotoUploadUrlResponse>;

/// <summary>
/// Handler for GenerateWorkOrderPhotoUploadUrlCommand.
/// Uses IPhotoService to generate presigned upload URL after verifying work order ownership.
/// </summary>
public class GenerateWorkOrderPhotoUploadUrlHandler : IRequestHandler<GenerateWorkOrderPhotoUploadUrlCommand, GenerateWorkOrderPhotoUploadUrlResponse>
{
    private readonly IPhotoService _photoService;
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GenerateWorkOrderPhotoUploadUrlHandler(
        IPhotoService photoService,
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _photoService = photoService;
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GenerateWorkOrderPhotoUploadUrlResponse> Handle(
        GenerateWorkOrderPhotoUploadUrlCommand request,
        CancellationToken cancellationToken)
    {
        // Verify work order exists and belongs to user's account
        var workOrderExists = await _dbContext.WorkOrders
            .AnyAsync(w => w.Id == request.WorkOrderId && w.AccountId == _currentUser.AccountId, cancellationToken);

        if (!workOrderExists)
        {
            throw new NotFoundException(nameof(WorkOrder), request.WorkOrderId);
        }

        var photoRequest = new PhotoUploadRequest(
            PhotoEntityType.WorkOrders,
            request.WorkOrderId,
            request.ContentType,
            request.FileSizeBytes,
            request.OriginalFileName);

        var result = await _photoService.GenerateUploadUrlAsync(
            _currentUser.AccountId,
            photoRequest,
            cancellationToken);

        return new GenerateWorkOrderPhotoUploadUrlResponse(
            UploadUrl: result.UploadUrl,
            StorageKey: result.StorageKey,
            ThumbnailStorageKey: result.ThumbnailStorageKey,
            ExpiresAt: result.ExpiresAt);
    }
}
