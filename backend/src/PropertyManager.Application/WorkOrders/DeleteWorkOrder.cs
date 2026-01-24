using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// Command for soft-deleting a work order (FR27).
/// Sets DeletedAt timestamp on work order record.
/// </summary>
public record DeleteWorkOrderCommand(Guid Id) : IRequest;

/// <summary>
/// Handler for DeleteWorkOrderCommand.
/// Soft-deletes the work order (FR27).
/// </summary>
public class DeleteWorkOrderCommandHandler : IRequestHandler<DeleteWorkOrderCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<DeleteWorkOrderCommandHandler> _logger;

    public DeleteWorkOrderCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<DeleteWorkOrderCommandHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task Handle(DeleteWorkOrderCommand request, CancellationToken cancellationToken)
    {
        // Find work order with tenant isolation and soft-delete check
        var workOrder = await _dbContext.WorkOrders
            .Where(w => w.Id == request.Id && w.AccountId == _currentUser.AccountId && w.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (workOrder == null)
        {
            _logger.LogWarning(
                "Work order not found for deletion: {WorkOrderId}, AccountId: {AccountId}",
                request.Id,
                _currentUser.AccountId);
            throw new NotFoundException(nameof(WorkOrder), request.Id);
        }

        // Soft delete - set DeletedAt timestamp (FR27)
        workOrder.DeletedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Work order deleted: {WorkOrderId}, AccountId: {AccountId}, UserId: {UserId}",
            request.Id,
            _currentUser.AccountId,
            _currentUser.UserId);
    }
}

/// <summary>
/// Validator for DeleteWorkOrderCommand.
/// </summary>
public class DeleteWorkOrderCommandValidator : AbstractValidator<DeleteWorkOrderCommand>
{
    public DeleteWorkOrderCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Work order ID is required");
    }
}
