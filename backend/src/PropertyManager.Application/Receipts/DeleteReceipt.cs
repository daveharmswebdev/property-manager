using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Command to soft-delete a receipt (AC-5.1.7).
/// </summary>
public record DeleteReceiptCommand(Guid Id) : IRequest<Unit>;

/// <summary>
/// Handler for DeleteReceiptCommand.
/// Soft-deletes receipt record and optionally deletes from S3.
/// Tenant isolation is enforced via global query filter.
/// </summary>
public class DeleteReceiptHandler : IRequestHandler<DeleteReceiptCommand, Unit>
{
    private readonly IAppDbContext _dbContext;
    private readonly IStorageService _storageService;
    private readonly ILogger<DeleteReceiptHandler> _logger;

    public DeleteReceiptHandler(
        IAppDbContext dbContext,
        IStorageService storageService,
        ILogger<DeleteReceiptHandler> logger)
    {
        _dbContext = dbContext;
        _storageService = storageService;
        _logger = logger;
    }

    public async Task<Unit> Handle(
        DeleteReceiptCommand request,
        CancellationToken cancellationToken)
    {
        var receipt = await _dbContext.Receipts
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (receipt == null)
        {
            throw new NotFoundException(nameof(Receipt), request.Id);
        }

        // Soft-delete the receipt
        receipt.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Optionally delete from S3 (fire-and-forget, don't fail if S3 delete fails)
        try
        {
            await _storageService.DeleteFileAsync(receipt.StorageKey, cancellationToken);
            _logger.LogInformation(
                "Deleted file {StorageKey} from S3 for receipt {ReceiptId}",
                receipt.StorageKey,
                receipt.Id);
        }
        catch (Exception ex)
        {
            // Log but don't fail - the receipt is already soft-deleted
            // A cleanup job can retry failed S3 deletions later
            _logger.LogWarning(ex,
                "Failed to delete file {StorageKey} from S3 for receipt {ReceiptId}. Will retry in cleanup job.",
                receipt.StorageKey,
                receipt.Id);
        }

        return Unit.Value;
    }
}
