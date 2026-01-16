using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.VendorTradeTags;

/// <summary>
/// Command for creating a new vendor trade tag (AC #4, #5).
/// </summary>
public record CreateVendorTradeTagCommand(string Name) : IRequest<Guid>;

/// <summary>
/// Handler for CreateVendorTradeTagCommand.
/// Creates a new trade tag with AccountId from current user.
/// Throws ConflictException if duplicate name exists for account.
/// </summary>
public class CreateVendorTradeTagCommandHandler : IRequestHandler<CreateVendorTradeTagCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateVendorTradeTagCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateVendorTradeTagCommand request, CancellationToken cancellationToken)
    {
        var normalizedName = request.Name.Trim();

        // Check for duplicate name within the account (case-insensitive)
        var duplicateExists = await _dbContext.VendorTradeTags
            .Where(t => t.AccountId == _currentUser.AccountId)
            .AnyAsync(t => t.Name.ToLower() == normalizedName.ToLower(), cancellationToken);

        if (duplicateExists)
        {
            throw new ConflictException($"A trade tag with name '{normalizedName}' already exists");
        }

        var tradeTag = new VendorTradeTag
        {
            Id = Guid.NewGuid(),
            AccountId = _currentUser.AccountId,
            Name = normalizedName,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.VendorTradeTags.Add(tradeTag);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return tradeTag.Id;
    }
}
