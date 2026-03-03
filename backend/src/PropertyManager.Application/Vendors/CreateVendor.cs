using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Command for creating a new vendor with full details (Story 17.8 AC #1).
/// New optional fields default to empty lists for backward compatibility.
/// </summary>
public record CreateVendorCommand(
    string FirstName,
    string? MiddleName,
    string LastName,
    List<PhoneNumberDto> Phones,
    List<string> Emails,
    List<Guid> TradeTagIds
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
        // Validate trade tags belong to current account
        if (request.TradeTagIds.Count > 0)
        {
            var validTagIds = await _dbContext.VendorTradeTags
                .Where(t => t.AccountId == _currentUser.AccountId && request.TradeTagIds.Contains(t.Id))
                .Select(t => t.Id)
                .ToListAsync(cancellationToken);

            var invalidTagIds = request.TradeTagIds.Except(validTagIds).ToList();
            if (invalidTagIds.Count > 0)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    { "tradeTagIds", new[] { $"Invalid trade tag IDs: {string.Join(", ", invalidTagIds)}" } }
                });
            }
        }

        var vendor = new Vendor
        {
            AccountId = _currentUser.AccountId,
            FirstName = request.FirstName,
            MiddleName = request.MiddleName,
            LastName = request.LastName,
            Phones = request.Phones.Select(p => new PhoneNumber(p.Number, p.Label)).ToList(),
            Emails = request.Emails.ToList(),
        };

        // Add trade tag assignments
        foreach (var tagId in request.TradeTagIds)
        {
            vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment
            {
                VendorId = vendor.Id,
                TradeTagId = tagId
            });
        }

        _dbContext.Vendors.Add(vendor);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return vendor.Id;
    }
}
