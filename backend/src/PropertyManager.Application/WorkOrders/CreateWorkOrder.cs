using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Command for creating a new work order (AC #1, AC #5).
/// </summary>
public record CreateWorkOrderCommand(
    Guid PropertyId,
    string Description,
    Guid? CategoryId,
    string? Status,
    List<Guid>? TagIds = null
) : IRequest<Guid>;

/// <summary>
/// Handler for CreateWorkOrderCommand.
/// Creates a new work order with AccountId and CreatedByUserId from current user.
/// Validates property, category (if provided), and tags (if provided) exist.
/// </summary>
public class CreateWorkOrderCommandHandler : IRequestHandler<CreateWorkOrderCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateWorkOrderCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateWorkOrderCommand request, CancellationToken cancellationToken)
    {
        // Validate property exists and belongs to user's account (global query filter handles account isolation)
        var propertyExists = await _dbContext.Properties
            .AnyAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (!propertyExists)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        // Validate category if provided (ExpenseCategories are global, no account filter)
        if (request.CategoryId.HasValue)
        {
            var categoryExists = await _dbContext.ExpenseCategories
                .AnyAsync(c => c.Id == request.CategoryId.Value, cancellationToken);

            if (!categoryExists)
            {
                throw new NotFoundException(nameof(ExpenseCategory), request.CategoryId.Value);
            }
        }

        // Validate tags if provided (AC #5, #7)
        if (request.TagIds?.Any() == true)
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

        // Parse status (case-insensitive) or default to Reported
        var status = WorkOrderStatus.Reported;
        if (!string.IsNullOrEmpty(request.Status))
        {
            if (!Enum.TryParse<WorkOrderStatus>(request.Status, ignoreCase: true, out status))
            {
                // This should be caught by validator, but defensive check
                throw new ArgumentException($"Invalid status: {request.Status}");
            }
        }

        var workOrder = new WorkOrder
        {
            AccountId = _currentUser.AccountId,
            PropertyId = request.PropertyId,
            CategoryId = request.CategoryId,
            Description = request.Description.Trim(),
            Status = status,
            CreatedByUserId = _currentUser.UserId
        };

        // Add tag assignments if provided (AC #5)
        if (request.TagIds?.Any() == true)
        {
            foreach (var tagId in request.TagIds)
            {
                workOrder.TagAssignments.Add(new WorkOrderTagAssignment
                {
                    WorkOrderId = workOrder.Id,
                    TagId = tagId
                });
            }
        }

        _dbContext.WorkOrders.Add(workOrder);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return workOrder.Id;
    }
}
