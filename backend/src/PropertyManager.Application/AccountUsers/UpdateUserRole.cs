using FluentValidation;
using MediatR;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.AccountUsers;

/// <summary>
/// Command to update a user's role within the current account (AC #2, #3).
/// </summary>
public record UpdateUserRoleCommand(Guid UserId, string Role) : IRequest;

/// <summary>
/// Handler for UpdateUserRoleCommand.
/// Enforces last-owner guard before delegating to identity service.
/// </summary>
public class UpdateUserRoleCommandHandler : IRequestHandler<UpdateUserRoleCommand>
{
    private readonly IIdentityService _identityService;
    private readonly ICurrentUser _currentUser;

    public UpdateUserRoleCommandHandler(IIdentityService identityService, ICurrentUser currentUser)
    {
        _identityService = identityService;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateUserRoleCommand request, CancellationToken cancellationToken)
    {
        // Last-owner guard: if changing a user away from Owner, ensure at least 1 Owner remains
        if (request.Role != "Owner")
        {
            var ownerCount = await _identityService.CountOwnersInAccountAsync(_currentUser.AccountId, cancellationToken);

            // Check if the target user is currently an Owner
            var users = await _identityService.GetAccountUsersAsync(_currentUser.AccountId, cancellationToken);
            var targetUser = users.FirstOrDefault(u => u.UserId == request.UserId);

            if (targetUser?.Role == "Owner" && ownerCount <= 1)
            {
                throw new ValidationException("Cannot remove the last owner from the account");
            }
        }

        var (success, errorMessage) = await _identityService.UpdateUserRoleAsync(
            request.UserId, _currentUser.AccountId, request.Role, cancellationToken);

        if (!success)
        {
            throw new Domain.Exceptions.NotFoundException("User", request.UserId);
        }
    }
}
