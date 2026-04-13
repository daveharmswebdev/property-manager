using MediatR;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Command for creating a new maintenance request (AC #4).
/// </summary>
public record CreateMaintenanceRequestCommand(string Description) : IRequest<Guid>;

/// <summary>
/// Handler for CreateMaintenanceRequestCommand.
/// Creates a maintenance request with the tenant's PropertyId and UserId from the current user context.
/// </summary>
public class CreateMaintenanceRequestCommandHandler : IRequestHandler<CreateMaintenanceRequestCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateMaintenanceRequestCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateMaintenanceRequestCommand request, CancellationToken cancellationToken)
    {
        // Tenant must have an assigned property
        if (_currentUser.PropertyId == null)
        {
            throw new BusinessRuleException("Cannot create a maintenance request without an assigned property.");
        }

        var maintenanceRequest = new MaintenanceRequest
        {
            AccountId = _currentUser.AccountId,
            PropertyId = _currentUser.PropertyId.Value,
            SubmittedByUserId = _currentUser.UserId,
            Description = request.Description.Trim(),
            Status = MaintenanceRequestStatus.Submitted
        };

        _dbContext.MaintenanceRequests.Add(maintenanceRequest);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return maintenanceRequest.Id;
    }
}
