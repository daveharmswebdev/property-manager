using MediatR;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Command for creating a new vendor with minimal required fields (AC #7).
/// </summary>
public record CreateVendorCommand(
    string FirstName,
    string? MiddleName,
    string LastName
) : IRequest<Guid>;

/// <summary>
/// Handler for CreateVendorCommand.
/// Creates a new vendor with AccountId from current user.
/// Uses TPT pattern - EF Core automatically inserts into both Person and Vendor tables.
/// </summary>
public class CreateVendorCommandHandler : IRequestHandler<CreateVendorCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateVendorCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateVendorCommand request, CancellationToken cancellationToken)
    {
        var vendor = new Vendor
        {
            AccountId = _currentUser.AccountId,
            FirstName = request.FirstName,
            MiddleName = request.MiddleName,
            LastName = request.LastName,
            Phones = [], // Explicit empty list for JSONB column
            Emails = []  // Explicit empty list for JSONB column
            // Note: Id, CreatedAt, UpdatedAt are auto-set by EF Core / DB defaults
        };

        _dbContext.Vendors.Add(vendor);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return vendor.Id;
    }
}
