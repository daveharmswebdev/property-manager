using MediatR;
using Microsoft.EntityFrameworkCore;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.WorkOrderTags;

/// <summary>
/// Command for creating a new work order tag (AC #2, #3).
/// </summary>
public record CreateWorkOrderTagCommand(string Name) : IRequest<Guid>;

/// <summary>
/// Handler for CreateWorkOrderTagCommand.
/// Creates a new work order tag with AccountId from current user.
/// Throws ConflictException if duplicate name exists for account.
/// </summary>
public class CreateWorkOrderTagCommandHandler : IRequestHandler<CreateWorkOrderTagCommand, Guid>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;

    public CreateWorkOrderTagCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateWorkOrderTagCommand request, CancellationToken cancellationToken)
    {
        var normalizedName = request.Name.Trim();

        // Check for duplicate name within the account (case-insensitive)
        var duplicateExists = await _dbContext.WorkOrderTags
            .Where(t => t.AccountId == _currentUser.AccountId)
            .AnyAsync(t => t.Name.ToLower() == normalizedName.ToLower(), cancellationToken);

        if (duplicateExists)
        {
            throw new ConflictException($"A work order tag with name '{normalizedName}' already exists");
        }

        var tag = new WorkOrderTag
        {
            Id = Guid.NewGuid(),
            AccountId = _currentUser.AccountId,
            Name = normalizedName,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.WorkOrderTags.Add(tag);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return tag.Id;
    }
}
