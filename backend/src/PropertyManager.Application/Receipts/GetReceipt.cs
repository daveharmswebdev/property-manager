using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Receipts;

/// <summary>
/// Query to get a receipt by ID with presigned view URL (AC-5.1.4).
/// </summary>
public record GetReceiptQuery(Guid Id) : IRequest<ReceiptDto>;

/// <summary>
/// DTO for receipt details including presigned view URL.
/// </summary>
public record ReceiptDto(
    Guid Id,
    string OriginalFileName,
    string ContentType,
    long FileSizeBytes,
    Guid? PropertyId,
    Guid? ExpenseId,
    DateTime CreatedAt,
    DateTime? ProcessedAt,
    string ViewUrl
);

/// <summary>
/// Handler for GetReceiptQuery.
/// Returns receipt details with a presigned download URL.
/// Tenant isolation is enforced via global query filter.
/// </summary>
public class GetReceiptHandler : IRequestHandler<GetReceiptQuery, ReceiptDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly IStorageService _storageService;

    public GetReceiptHandler(
        IAppDbContext dbContext,
        IStorageService storageService)
    {
        _dbContext = dbContext;
        _storageService = storageService;
    }

    public async Task<ReceiptDto> Handle(
        GetReceiptQuery request,
        CancellationToken cancellationToken)
    {
        var receipt = await _dbContext.Receipts
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (receipt == null)
        {
            throw new NotFoundException(nameof(Receipt), request.Id);
        }

        // Generate presigned download URL
        var viewUrl = await _storageService.GeneratePresignedDownloadUrlAsync(
            receipt.StorageKey,
            cancellationToken);

        return new ReceiptDto(
            Id: receipt.Id,
            OriginalFileName: receipt.OriginalFileName ?? string.Empty,
            ContentType: receipt.ContentType ?? string.Empty,
            FileSizeBytes: receipt.FileSizeBytes ?? 0,
            PropertyId: receipt.PropertyId,
            ExpenseId: receipt.ExpenseId,
            CreatedAt: receipt.CreatedAt,
            ProcessedAt: receipt.ProcessedAt,
            ViewUrl: viewUrl
        );
    }
}
