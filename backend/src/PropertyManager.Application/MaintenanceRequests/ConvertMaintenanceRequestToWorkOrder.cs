using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Command for converting a maintenance request into a work order (Story 20.8, AC #5, #6).
/// Atomically creates a WorkOrder, mirrors photo rows (sharing S3 keys), links the
/// maintenance request to the new WO, and transitions the request status to InProgress.
/// </summary>
public record ConvertMaintenanceRequestToWorkOrderCommand(
    Guid MaintenanceRequestId,
    string Description,
    Guid? CategoryId,
    Guid? VendorId
) : IRequest<ConvertMaintenanceRequestToWorkOrderResponse>;

/// <summary>
/// Response shape returned by the convert endpoint (AC #7).
/// </summary>
public record ConvertMaintenanceRequestToWorkOrderResponse(
    Guid WorkOrderId,
    Guid MaintenanceRequestId);

/// <summary>
/// Handler for <see cref="ConvertMaintenanceRequestToWorkOrderCommand"/>.
/// Wraps both saves in an explicit transaction; the second save calls
/// <see cref="MaintenanceRequest.TransitionTo"/> which enforces the
/// Submitted → InProgress rule (AC #5, #10).
/// </summary>
public class ConvertMaintenanceRequestToWorkOrderCommandHandler
    : IRequestHandler<ConvertMaintenanceRequestToWorkOrderCommand, ConvertMaintenanceRequestToWorkOrderResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<ConvertMaintenanceRequestToWorkOrderCommandHandler> _logger;

    public ConvertMaintenanceRequestToWorkOrderCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<ConvertMaintenanceRequestToWorkOrderCommandHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<ConvertMaintenanceRequestToWorkOrderResponse> Handle(
        ConvertMaintenanceRequestToWorkOrderCommand request,
        CancellationToken cancellationToken)
    {
        // Load the maintenance request with its photos (AC #6). Global query filter scopes by account.
        var maintenanceRequest = await _dbContext.MaintenanceRequests
            .Include(mr => mr.Photos)
            .FirstOrDefaultAsync(
                mr => mr.Id == request.MaintenanceRequestId
                    && mr.AccountId == _currentUser.AccountId
                    && mr.DeletedAt == null,
                cancellationToken);

        if (maintenanceRequest == null)
        {
            throw new NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId);
        }

        // Validate category if provided (ExpenseCategories are global, no account filter — matches CreateWorkOrder)
        if (request.CategoryId.HasValue)
        {
            var categoryExists = await _dbContext.ExpenseCategories
                .AnyAsync(c => c.Id == request.CategoryId.Value, cancellationToken);

            if (!categoryExists)
            {
                throw new NotFoundException(nameof(ExpenseCategory), request.CategoryId.Value);
            }
        }

        // Validate vendor if provided (account-scoped explicitly for parity with CreateWorkOrder).
        if (request.VendorId.HasValue)
        {
            var vendorExists = await _dbContext.Vendors
                .AnyAsync(v => v.Id == request.VendorId.Value
                            && v.AccountId == _currentUser.AccountId, cancellationToken);

            if (!vendorExists)
            {
                throw new NotFoundException(nameof(Vendor), request.VendorId.Value);
            }
        }

        // Transaction wraps both saves. `await using` rolls back on any thrown exception
        // (mirrors SetPrimaryWorkOrderPhoto pattern). Global middleware maps the exception to ProblemDetails.
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Step 1: insert the new work order and mirrored photo rows.
        // Pre-assign Id so we can scope MaintenanceRequest.WorkOrderId and any related
        // WorkOrderPhoto FK references without an interim SaveChanges. The DB column has
        // `gen_random_uuid()` as a default, but EF only uses it when Id is Guid.Empty —
        // setting it client-side overrides the default and is the standard pattern.
        var workOrder = new WorkOrder
        {
            Id = Guid.NewGuid(),
            AccountId = _currentUser.AccountId,
            PropertyId = maintenanceRequest.PropertyId,
            Description = request.Description.Trim(),
            CategoryId = request.CategoryId,
            VendorId = request.VendorId,
            Status = WorkOrderStatus.Reported,
            CreatedByUserId = _currentUser.UserId,
        };
        _dbContext.WorkOrders.Add(workOrder);

        // AC #6: photo rows are mirrored, S3 objects are shared (see Story 20.8 Dev Notes).
        foreach (var src in maintenanceRequest.Photos)
        {
            _dbContext.WorkOrderPhotos.Add(new WorkOrderPhoto
            {
                AccountId = _currentUser.AccountId,
                WorkOrderId = workOrder.Id,
                StorageKey = src.StorageKey,
                ThumbnailStorageKey = src.ThumbnailStorageKey,
                OriginalFileName = src.OriginalFileName,
                ContentType = src.ContentType,
                FileSizeBytes = src.FileSizeBytes,
                DisplayOrder = src.DisplayOrder,
                IsPrimary = src.IsPrimary,
                CreatedByUserId = _currentUser.UserId,
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Step 2: link the maintenance request and transition status (enforces Submitted → InProgress).
        maintenanceRequest.WorkOrderId = workOrder.Id;
        maintenanceRequest.TransitionTo(MaintenanceRequestStatus.InProgress);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Converted maintenance request {RequestId} to work order {WorkOrderId}",
            maintenanceRequest.Id,
            workOrder.Id);

        return new ConvertMaintenanceRequestToWorkOrderResponse(workOrder.Id, maintenanceRequest.Id);
    }
}
