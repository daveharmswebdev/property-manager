using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorTradeTags;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Query to get a single vendor by ID with full details.
/// </summary>
public record GetVendorQuery(Guid VendorId) : IRequest<VendorDetailDto>;

/// <summary>
/// Handler for GetVendorQuery.
/// Returns full vendor details including phones, emails, and trade tags.
/// </summary>
public class GetVendorQueryHandler : IRequestHandler<GetVendorQuery, VendorDetailDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetVendorQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<VendorDetailDto> Handle(GetVendorQuery request, CancellationToken cancellationToken)
    {
        var vendor = await _dbContext.Vendors
            .Where(v => v.Id == request.VendorId
                && v.AccountId == _currentUser.AccountId
                && v.DeletedAt == null)
            .Include(v => v.TradeTagAssignments)
                .ThenInclude(a => a.TradeTag)
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (vendor is null)
        {
            throw new NotFoundException("Vendor", request.VendorId);
        }

        return new VendorDetailDto(
            vendor.Id,
            vendor.FirstName,
            vendor.MiddleName,
            vendor.LastName,
            vendor.FullName,
            vendor.Phones.Select(p => new PhoneNumberDto(p.Number, p.Label)).ToList(),
            vendor.Emails.ToList(),
            vendor.TradeTagAssignments.Select(a => new VendorTradeTagDto(a.TradeTag.Id, a.TradeTag.Name)).ToList()
        );
    }
}
