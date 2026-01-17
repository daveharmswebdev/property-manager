using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// Command for updating an existing vendor with full details (AC #12, #15).
/// </summary>
public record UpdateVendorCommand(
    Guid Id,
    string FirstName,
    string? MiddleName,
    string LastName,
    List<PhoneNumberDto> Phones,
    List<string> Emails,
    List<Guid> TradeTagIds
) : IRequest;

/// <summary>
/// Handler for UpdateVendorCommand.
/// Updates Person fields and syncs trade tag assignments.
/// </summary>
public class UpdateVendorCommandHandler : IRequestHandler<UpdateVendorCommand>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public UpdateVendorCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateVendorCommand request, CancellationToken cancellationToken)
    {
        var vendor = await _dbContext.Vendors
            .Include(v => v.TradeTagAssignments)
            .Where(v => v.Id == request.Id
                && v.AccountId == _currentUser.AccountId
                && v.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (vendor is null)
        {
            throw new NotFoundException("Vendor", request.Id);
        }

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

        // Update Person fields
        vendor.FirstName = request.FirstName;
        vendor.MiddleName = request.MiddleName;
        vendor.LastName = request.LastName;
        vendor.Phones = request.Phones.Select(p => new PhoneNumber(p.Number, p.Label)).ToList();
        vendor.Emails = request.Emails.ToList();

        // Sync trade tag assignments
        var currentTagIds = vendor.TradeTagAssignments.Select(a => a.TradeTagId).ToHashSet();
        var newTagIds = request.TradeTagIds.ToHashSet();

        // Remove old assignments
        var toRemove = vendor.TradeTagAssignments.Where(a => !newTagIds.Contains(a.TradeTagId)).ToList();
        foreach (var assignment in toRemove)
        {
            vendor.TradeTagAssignments.Remove(assignment);
        }

        // Add new assignments
        var toAdd = newTagIds.Except(currentTagIds);
        foreach (var tagId in toAdd)
        {
            vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment
            {
                VendorId = vendor.Id,
                TradeTagId = tagId
            });
        }

        // UpdatedAt is set automatically by AppDbContext.SaveChangesAsync
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
