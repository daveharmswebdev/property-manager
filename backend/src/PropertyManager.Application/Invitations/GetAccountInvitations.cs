using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// DTO representing an invitation in the account (AC: #3, #4).
/// </summary>
public record InvitationDto(
    Guid Id,
    string Email,
    string Role,
    DateTime CreatedAt,
    DateTime ExpiresAt,
    DateTime? UsedAt,
    string Status);

/// <summary>
/// Query to retrieve all invitations for the current user's account.
/// </summary>
public record GetAccountInvitationsQuery : IRequest<GetAccountInvitationsResponse>;

/// <summary>
/// Response containing the list of account invitations.
/// </summary>
public record GetAccountInvitationsResponse(IReadOnlyList<InvitationDto> Items, int TotalCount);

/// <summary>
/// Handler for GetAccountInvitationsQuery.
/// Queries invitations by AccountId and derives status from entity properties.
/// </summary>
public class GetAccountInvitationsQueryHandler : IRequestHandler<GetAccountInvitationsQuery, GetAccountInvitationsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<GetAccountInvitationsQueryHandler> _logger;

    public GetAccountInvitationsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<GetAccountInvitationsQueryHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<GetAccountInvitationsResponse> Handle(GetAccountInvitationsQuery request, CancellationToken cancellationToken)
    {
        var invitations = await _dbContext.Invitations
            .Where(i => i.AccountId == _currentUser.AccountId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        var dtos = invitations.Select(i => new InvitationDto(
            i.Id,
            i.Email,
            i.Role,
            i.CreatedAt,
            i.ExpiresAt,
            i.UsedAt,
            DeriveStatus(i))).ToList();

        var accountIdForLog = _currentUser.AccountId == Guid.Empty
            ? "empty"
            : _currentUser.AccountId.ToString("N")[..8];
        _logger.LogInformation("Retrieved {Count} invitations for account {AccountId}", dtos.Count, accountIdForLog);

        return new GetAccountInvitationsResponse(dtos.AsReadOnly(), dtos.Count);
    }

    private static string DeriveStatus(Domain.Entities.Invitation invitation)
    {
        if (invitation.UsedAt != null) return "Accepted";
        if (invitation.ExpiresAt < DateTime.UtcNow) return "Expired";
        return "Pending";
    }
}
