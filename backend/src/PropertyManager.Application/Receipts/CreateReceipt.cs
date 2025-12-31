using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Command to confirm S3 upload and create receipt record (AC-5.1.3).
/// </summary>
public record CreateReceiptCommand(
    string StorageKey,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId = null
) : IRequest<Guid>;

/// <summary>
/// Handler for CreateReceiptCommand.
/// Creates a receipt record after client has uploaded to S3.
/// </summary>
public class CreateReceiptHandler : IRequestHandler<CreateReceiptCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateReceiptHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(
        CreateReceiptCommand request,
        CancellationToken cancellationToken)
    {
        // Validate property exists if provided (global query filter handles account isolation)
        if (request.PropertyId.HasValue)
        {
            var propertyExists = await _dbContext.Properties
                .AnyAsync(p => p.Id == request.PropertyId.Value, cancellationToken);

            if (!propertyExists)
            {
                throw new NotFoundException(nameof(Property), request.PropertyId.Value);
            }
        }

        var receipt = new Receipt
        {
            AccountId = _currentUser.AccountId,
            StorageKey = request.StorageKey,
            OriginalFileName = request.OriginalFileName,
            ContentType = request.ContentType,
            FileSizeBytes = request.FileSizeBytes,
            PropertyId = request.PropertyId,
            CreatedByUserId = _currentUser.UserId
        };

        _dbContext.Receipts.Add(receipt);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return receipt.Id;
    }
}
