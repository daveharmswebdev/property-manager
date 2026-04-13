using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Query to get a single maintenance request by ID (AC #7).
/// </summary>
public record GetMaintenanceRequestByIdQuery(Guid Id) : IRequest<MaintenanceRequestDto>;

/// <summary>
/// Handler for GetMaintenanceRequestByIdQuery.
/// Returns full maintenance request detail with property and submitter info.
/// Tenant users can only access requests on their assigned property.
/// </summary>
public class GetMaintenanceRequestByIdQueryHandler : IRequestHandler<GetMaintenanceRequestByIdQuery, MaintenanceRequestDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IIdentityService _identityService;

    public GetMaintenanceRequestByIdQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IIdentityService identityService)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _identityService = identityService;
    }

    public async Task<MaintenanceRequestDto> Handle(GetMaintenanceRequestByIdQuery request, CancellationToken cancellationToken)
    {
        var maintenanceRequest = await _dbContext.MaintenanceRequests
            .Where(mr => mr.Id == request.Id
                && mr.AccountId == _currentUser.AccountId
                && mr.DeletedAt == null)
            .Include(mr => mr.Property)
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (maintenanceRequest is null)
        {
            throw new NotFoundException(nameof(Domain.Entities.MaintenanceRequest), request.Id);
        }

        // Tenant users can only access requests on their assigned property
        if (_currentUser.Role == "Tenant" && _currentUser.PropertyId.HasValue
            && maintenanceRequest.PropertyId != _currentUser.PropertyId.Value)
        {
            throw new NotFoundException(nameof(Domain.Entities.MaintenanceRequest), request.Id);
        }

        // Lookup submitter display name
        var displayNames = await _identityService.GetUserDisplayNamesAsync(
            new[] { maintenanceRequest.SubmittedByUserId }, cancellationToken);

        return new MaintenanceRequestDto(
            maintenanceRequest.Id,
            maintenanceRequest.PropertyId,
            maintenanceRequest.Property.Name,
            $"{maintenanceRequest.Property.Street}, {maintenanceRequest.Property.City}, {maintenanceRequest.Property.State} {maintenanceRequest.Property.ZipCode}",
            maintenanceRequest.Description,
            maintenanceRequest.Status.ToString(),
            maintenanceRequest.DismissalReason,
            maintenanceRequest.SubmittedByUserId,
            displayNames.GetValueOrDefault(maintenanceRequest.SubmittedByUserId),
            maintenanceRequest.WorkOrderId,
            maintenanceRequest.CreatedAt,
            maintenanceRequest.UpdatedAt
        );
    }
}
