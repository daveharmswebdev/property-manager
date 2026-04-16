using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Query to get the current tenant's assigned property info (Story 20.5, AC #2).
/// Returns read-only property data (no financial info).
/// </summary>
public record GetTenantPropertyQuery() : IRequest<TenantPropertyDto>;

/// <summary>
/// DTO for tenant property display — read-only, no financial data.
/// </summary>
public record TenantPropertyDto(
    Guid Id,
    string Name,
    string Street,
    string City,
    string State,
    string ZipCode
);

/// <summary>
/// Handler for GetTenantPropertyQuery.
/// Returns property info for the current tenant user using PropertyId from JWT.
/// </summary>
public class GetTenantPropertyQueryHandler : IRequestHandler<GetTenantPropertyQuery, TenantPropertyDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public GetTenantPropertyQueryHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<TenantPropertyDto> Handle(GetTenantPropertyQuery request, CancellationToken cancellationToken)
    {
        if (_currentUser.Role != "Tenant")
        {
            throw new BusinessRuleException("This endpoint is only accessible to Tenant users.");
        }

        if (!_currentUser.PropertyId.HasValue)
        {
            throw new BusinessRuleException("Tenant user must have an assigned property.");
        }

        var property = await _dbContext.Properties
            .Where(p => p.Id == _currentUser.PropertyId.Value
                && p.AccountId == _currentUser.AccountId
                && p.DeletedAt == null)
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (property is null)
        {
            throw new NotFoundException(nameof(Domain.Entities.Property), _currentUser.PropertyId.Value);
        }

        return new TenantPropertyDto(
            property.Id,
            property.Name,
            property.Street,
            property.City,
            property.State,
            property.ZipCode
        );
    }
}
