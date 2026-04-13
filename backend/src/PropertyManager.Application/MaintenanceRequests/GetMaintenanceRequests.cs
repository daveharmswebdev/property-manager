using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Query to get maintenance requests with role-based filtering and pagination (AC #5, #6).
/// </summary>
public record GetMaintenanceRequestsQuery(
    string? Status = null,
    Guid? PropertyId = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<GetMaintenanceRequestsResponse>;

/// <summary>
/// Paginated response for maintenance requests.
/// </summary>
public record GetMaintenanceRequestsResponse(
    IReadOnlyList<MaintenanceRequestDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

/// <summary>
/// Handler for GetMaintenanceRequestsQuery.
/// Tenant users see requests for their property (shared visibility).
/// Landlord users see all requests across their account.
/// </summary>
public class GetMaintenanceRequestsQueryHandler : IRequestHandler<GetMaintenanceRequestsQuery, GetMaintenanceRequestsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly IIdentityService _identityService;

    public GetMaintenanceRequestsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        IIdentityService identityService)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _identityService = identityService;
    }

    public async Task<GetMaintenanceRequestsResponse> Handle(GetMaintenanceRequestsQuery request, CancellationToken cancellationToken)
    {
        var query = _dbContext.MaintenanceRequests
            .Where(mr => mr.AccountId == _currentUser.AccountId && mr.DeletedAt == null)
            .Include(mr => mr.Property)
            .AsQueryable();

        // Role-based filtering: tenant sees only their property's requests
        if (_currentUser.Role == "Tenant" && _currentUser.PropertyId.HasValue)
        {
            query = query.Where(mr => mr.PropertyId == _currentUser.PropertyId.Value);
        }

        // Apply optional status filter (case-insensitive)
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (Enum.TryParse<MaintenanceRequestStatus>(request.Status, ignoreCase: true, out var statusEnum))
            {
                query = query.Where(mr => mr.Status == statusEnum);
            }
        }

        // Apply optional property filter (for landlord filtering by property)
        if (request.PropertyId.HasValue)
        {
            query = query.Where(mr => mr.PropertyId == request.PropertyId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var maintenanceRequests = await query
            .OrderByDescending(mr => mr.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Lookup submitter display names
        var userIds = maintenanceRequests.Select(mr => mr.SubmittedByUserId).Distinct();
        var displayNames = await _identityService.GetUserDisplayNamesAsync(userIds, cancellationToken);

        var items = maintenanceRequests.Select(mr => new MaintenanceRequestDto(
            mr.Id,
            mr.PropertyId,
            mr.Property.Name,
            $"{mr.Property.Street}, {mr.Property.City}, {mr.Property.State} {mr.Property.ZipCode}",
            mr.Description,
            mr.Status.ToString(),
            mr.DismissalReason,
            mr.SubmittedByUserId,
            displayNames.GetValueOrDefault(mr.SubmittedByUserId),
            mr.WorkOrderId,
            mr.CreatedAt,
            mr.UpdatedAt
        )).ToList();

        var totalPages = (int)Math.Ceiling((double)totalCount / request.PageSize);

        return new GetMaintenanceRequestsResponse(items, totalCount, request.Page, request.PageSize, totalPages);
    }
}
