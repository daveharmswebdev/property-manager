using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorTradeTags;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Query to get all vendors for the current user's account.
/// </summary>
public record GetAllVendorsQuery : IRequest<GetAllVendorsResponse>;

/// <summary>
/// Response containing list of vendors with pagination info.
/// </summary>
public record GetAllVendorsResponse(
    IReadOnlyList<VendorDto> Items,
    int TotalCount
);

/// <summary>
/// Handler for GetAllVendorsQuery.
/// Returns all vendors for the current user's account.
/// Note: Soft delete filter is applied explicitly since TPT inheritance
/// doesn't support query filters on derived types.
/// Note: AccountId filter is explicit here as defense-in-depth alongside Person's
/// global query filter, ensuring tenant isolation even if global filter changes.
/// </summary>
public class GetAllVendorsQueryHandler : IRequestHandler<GetAllVendorsQuery, GetAllVendorsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetAllVendorsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<GetAllVendorsResponse> Handle(GetAllVendorsQuery request, CancellationToken cancellationToken)
    {
        var vendors = await _dbContext.Vendors
            .Where(v => v.AccountId == _currentUser.AccountId && v.DeletedAt == null)
            .Include(v => v.TradeTagAssignments)
                .ThenInclude(a => a.TradeTag)
            .OrderBy(v => v.LastName)
            .ThenBy(v => v.FirstName)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var vendorDtos = vendors.Select(v => new VendorDto(
            v.Id,
            v.FirstName,
            v.LastName,
            v.FullName,
            v.Phones.Select(p => new PhoneNumberDto(p.Number, p.Label)).ToList(),
            v.Emails.ToList(),
            v.TradeTagAssignments
                .Select(a => new VendorTradeTagDto(a.TradeTag.Id, a.TradeTag.Name))
                .ToList()
        )).ToList();

        return new GetAllVendorsResponse(vendorDtos, vendorDtos.Count);
    }
}
