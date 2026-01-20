using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Application.WorkOrderTags;

/// <summary>
/// Query to get all work order tags for the current user's account (AC #1).
/// </summary>
public record GetAllWorkOrderTagsQuery : IRequest<GetAllWorkOrderTagsResponse>;

/// <summary>
/// Response containing list of work order tags with pagination info.
/// </summary>
public record GetAllWorkOrderTagsResponse(
    IReadOnlyList<WorkOrderTagDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetAllWorkOrderTagsQuery.
/// Returns all work order tags for the current user's account, sorted alphabetically by name.
/// Note: AccountId filter is explicit here as defense-in-depth alongside global query filter.
/// </summary>
public class GetAllWorkOrderTagsQueryHandler : IRequestHandler<GetAllWorkOrderTagsQuery, GetAllWorkOrderTagsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetAllWorkOrderTagsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetAllWorkOrderTagsResponse> Handle(GetAllWorkOrderTagsQuery request, CancellationToken cancellationToken)
    {
        var tags = await _dbContext.WorkOrderTags
            .Where(t => t.AccountId == _currentUser.AccountId)
            .OrderBy(t => t.Name)
            .Select(t => new WorkOrderTagDto(t.Id, t.Name))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new GetAllWorkOrderTagsResponse(tags, tags.Count);
    }
}
