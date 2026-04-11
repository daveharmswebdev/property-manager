using System.Text.Json.Serialization;
using MediatR;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.AccountUsers;

/// <summary>
/// DTO representing a user within an account.
/// </summary>
public record AccountUserDto(
    Guid UserId,
    string Email,
    string? DisplayName,
    string Role,
    DateTime CreatedAt,
    [property: JsonPropertyName("isAccountCreator")] bool IsAccountCreator);

/// <summary>
/// Query to retrieve all users in the current user's account.
/// </summary>
public record GetAccountUsersQuery : IRequest<GetAccountUsersResponse>;

/// <summary>
/// Response containing the list of account users.
/// </summary>
public record GetAccountUsersResponse(IReadOnlyList<AccountUserDto> Items, int TotalCount);

/// <summary>
/// Handler for GetAccountUsersQuery (AC #1).
/// </summary>
public class GetAccountUsersQueryHandler : IRequestHandler<GetAccountUsersQuery, GetAccountUsersResponse>
{
    private readonly IIdentityService _identityService;
    private readonly ICurrentUser _currentUser;

    public GetAccountUsersQueryHandler(IIdentityService identityService, ICurrentUser currentUser)
    {
        _identityService = identityService;
        _currentUser = currentUser;
    }

    public async Task<GetAccountUsersResponse> Handle(GetAccountUsersQuery request, CancellationToken cancellationToken)
    {
        var users = await _identityService.GetAccountUsersAsync(_currentUser.AccountId, cancellationToken);
        return new GetAccountUsersResponse(users.AsReadOnly(), users.Count);
    }
}
