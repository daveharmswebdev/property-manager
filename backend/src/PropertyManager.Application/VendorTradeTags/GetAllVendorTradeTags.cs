using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.VendorTradeTags;

/// <summary>
/// Query to get all vendor trade tags for the current user's account.
/// </summary>
public record GetAllVendorTradeTagsQuery : IRequest<GetAllVendorTradeTagsResponse>;

/// <summary>
/// Response containing list of trade tags with pagination info.
/// </summary>
public record GetAllVendorTradeTagsResponse(
    IReadOnlyList<VendorTradeTagDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetAllVendorTradeTagsQuery.
/// Returns all trade tags for the current user's account, sorted alphabetically by name.
/// Note: AccountId filter is explicit here as defense-in-depth alongside global query filter.
/// </summary>
public class GetAllVendorTradeTagsQueryHandler : IRequestHandler<GetAllVendorTradeTagsQuery, GetAllVendorTradeTagsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetAllVendorTradeTagsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetAllVendorTradeTagsResponse> Handle(GetAllVendorTradeTagsQuery request, CancellationToken cancellationToken)
    {
        var tradeTags = await _dbContext.VendorTradeTags
            .Where(t => t.AccountId == _currentUser.AccountId)
            .OrderBy(t => t.Name)
            .Select(t => new VendorTradeTagDto(t.Id, t.Name))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new GetAllVendorTradeTagsResponse(tradeTags, tradeTags.Count);
    }
}
