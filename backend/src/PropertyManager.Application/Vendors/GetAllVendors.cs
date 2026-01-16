using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;

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
            .OrderBy(v => v.LastName)
            .ThenBy(v => v.FirstName)
            .Select(v => new VendorDto(
                v.Id,
                v.FirstName,
                v.LastName,
                string.IsNullOrWhiteSpace(v.MiddleName)
                    ? v.FirstName + " " + v.LastName
                    : v.FirstName + " " + v.MiddleName + " " + v.LastName
            ))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new GetAllVendorsResponse(vendors, vendors.Count);
    }
}
