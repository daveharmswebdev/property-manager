using MediatR;
using Microsoft.EntityFrameworkCore;
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

    public UpdateWorkOrderCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
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

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
