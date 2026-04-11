using FluentValidation;
using MediatR;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.AccountUsers;

/// <summary>
/// Command to remove (disable) a user from the current account (AC #4, #3).
/// </summary>
public record RemoveAccountUserCommand(Guid UserId) : IRequest;

/// <summary>
/// Handler for RemoveAccountUserCommand.
/// Enforces last-owner guard before delegating to identity service.
/// </summary>
public class RemoveAccountUserCommandHandler : IRequestHandler<RemoveAccountUserCommand>
{
    private readonly IIdentityService _identityService;
    private readonly ICurrentUser _currentUser;

    public RemoveAccountUserCommandHandler(IIdentityService identityService, ICurrentUser currentUser)
    {
        _identityService = identityService;
        _currentUser = currentUser;
    }

    public async Task Handle(RemoveAccountUserCommand request, CancellationToken cancellationToken)
    {
        // Check if target user exists in account
        var users = await _identityService.GetAccountUsersAsync(_currentUser.AccountId, cancellationToken);
        var targetUser = users.FirstOrDefault(u => u.UserId == request.UserId);

        if (targetUser == null)
        {
            throw new Domain.Exceptions.NotFoundException("User", request.UserId);
        }

        // Account creator guard: the account creator cannot be removed
        if (targetUser.IsAccountCreator)
        {
            throw new ValidationException("Cannot remove the account creator");
        }

        // Last-owner guard: prevent removing the last owner
        if (targetUser.Role == "Owner")
        {
            var ownerCount = await _identityService.CountOwnersInAccountAsync(_currentUser.AccountId, cancellationToken);
            if (ownerCount <= 1)
            {
                throw new ValidationException("Cannot remove the last owner from the account");
            }
        }

        var (success, errorMessage) = await _identityService.RemoveUserFromAccountAsync(
            request.UserId, _currentUser.AccountId, cancellationToken);

        if (!success)
        {
            throw new Domain.Exceptions.NotFoundException("User", request.UserId);
        }
    }
}
