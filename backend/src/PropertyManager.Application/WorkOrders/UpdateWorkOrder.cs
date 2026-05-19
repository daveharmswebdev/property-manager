using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Command for updating an existing work order (AC #6).
/// </summary>
public record UpdateWorkOrderCommand(
    Guid Id,
    string Description,
    Guid? CategoryId,
    string? Status,
    Guid? VendorId,
    List<Guid>? TagIds
) : IRequest;

/// <summary>
/// Handler for UpdateWorkOrderCommand.
/// Updates work order fields and tag associations.
/// Validates work order, category (if provided), and tags (if provided) exist.
/// </summary>
public class UpdateWorkOrderCommandHandler : IRequestHandler<UpdateWorkOrderCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<UpdateWorkOrderCommandHandler> _logger;

    public UpdateWorkOrderCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<UpdateWorkOrderCommandHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task Handle(UpdateWorkOrderCommand request, CancellationToken cancellationToken)
    {
        // Get work order with tag assignments (account filter applied via global query filter)
        var workOrder = await _dbContext.WorkOrders
            .Include(wo => wo.TagAssignments)
            .FirstOrDefaultAsync(wo => wo.Id == request.Id && wo.AccountId == _currentUser.AccountId, cancellationToken);

        if (workOrder == null)
        {
            throw new NotFoundException(nameof(WorkOrder), request.Id);
        }

        // Capture prior status BEFORE any mutation so we can detect a true status transition
        // for the Story 20.10 sync block below.
        var priorStatus = workOrder.Status;

        // Validate category if provided
        if (request.CategoryId.HasValue)
        {
            var categoryExists = await _dbContext.ExpenseCategories
                .AnyAsync(c => c.Id == request.CategoryId.Value, cancellationToken);

            if (!categoryExists)
            {
                throw new NotFoundException(nameof(ExpenseCategory), request.CategoryId.Value);
            }
        }

        // Validate vendor if provided
        if (request.VendorId.HasValue)
        {
            var vendorExists = await _dbContext.Vendors
                .AnyAsync(v => v.Id == request.VendorId.Value && v.AccountId == _currentUser.AccountId, cancellationToken);

            if (!vendorExists)
            {
                throw new NotFoundException(nameof(Vendor), request.VendorId.Value);
            }
        }

        // Validate tags if provided (AC #7)
        if (request.TagIds != null && request.TagIds.Any())
        {
            var validTagIds = await _dbContext.WorkOrderTags
                .Where(t => t.AccountId == _currentUser.AccountId)
                .Where(t => request.TagIds.Contains(t.Id))
                .Select(t => t.Id)
                .ToListAsync(cancellationToken);

            var invalidIds = request.TagIds.Except(validTagIds).ToList();
            if (invalidIds.Any())
            {
                throw new NotFoundException(nameof(WorkOrderTag), invalidIds.First());
            }
        }

        // Update fields
        workOrder.Description = request.Description.Trim();
        workOrder.CategoryId = request.CategoryId;
        workOrder.VendorId = request.VendorId;

        // Parse status if provided
        if (!string.IsNullOrEmpty(request.Status))
        {
            if (Enum.TryParse<WorkOrderStatus>(request.Status, ignoreCase: true, out var status))
            {
                workOrder.Status = status;
            }
        }

        // Update tag assignments if TagIds is explicitly provided (null means don't modify)
        if (request.TagIds != null)
        {
            // Clear existing assignments
            workOrder.TagAssignments.Clear();

            // Add new assignments
            foreach (var tagId in request.TagIds)
            {
                workOrder.TagAssignments.Add(new WorkOrderTagAssignment
                {
                    WorkOrderId = workOrder.Id,
                    TagId = tagId
                });
            }
        }

        // Story 20.10: Sync linked MaintenanceRequest to Resolved when this WO transitions
        // from a non-Completed status to Completed. Guarded transition-only (AC #3): a no-op
        // PUT that keeps Completed → Completed does NOT trigger the sync. Unlinked work orders
        // and non-Completed transitions skip the lookup entirely (AC #4, #11).
        if (workOrder.Status == WorkOrderStatus.Completed
            && priorStatus != WorkOrderStatus.Completed)
        {
            var linkedRequest = await _dbContext.MaintenanceRequests
                .FirstOrDefaultAsync(
                    mr => mr.WorkOrderId == workOrder.Id
                        && mr.AccountId == _currentUser.AccountId
                        && mr.DeletedAt == null,
                    cancellationToken);

            if (linkedRequest != null && linkedRequest.Status != MaintenanceRequestStatus.Resolved)
            {
                // Domain enforces InProgress → Resolved. Any other source status throws
                // BusinessRuleException → 400 (AC #7) and rolls back the WO update via EF's
                // implicit SaveChanges transaction.
                linkedRequest.TransitionTo(MaintenanceRequestStatus.Resolved);

                _logger.LogInformation(
                    "Linked maintenance request {RequestId} marked Resolved due to work order {WorkOrderId} completion",
                    linkedRequest.Id,
                    workOrder.Id);
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
