using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Invitations;

/// <summary>
/// DTO representing a landlord (top-level, AccountId == null) invitation (Story 22.4, AC: #3).
/// </summary>
public record LandlordInvitationDto(
    Guid Id,
    string Email,
    DateTime CreatedAt,
    DateTime ExpiresAt,
    DateTime? UsedAt,
    string Status,
    string InvitedBy);

/// <summary>
/// Query to retrieve all landlord invitations (those with AccountId == null).
/// Admin-scoped; the PlatformAdmin gate lives on the controller.
/// </summary>
public record GetLandlordInvitationsQuery : IRequest<GetLandlordInvitationsResponse>;

/// <summary>
/// Response containing the list of landlord invitations.
/// </summary>
public record GetLandlordInvitationsResponse(IReadOnlyList<LandlordInvitationDto> Items, int TotalCount);

/// <summary>
/// Handler for <see cref="GetLandlordInvitationsQuery"/>.
/// Queries invitations where AccountId == null (landlord invitations), derives status,
/// and resolves the inviting admin's display name for the "Invited By" column.
/// </summary>
public class GetLandlordInvitationsQueryHandler
    : IRequestHandler<GetLandlordInvitationsQuery, GetLandlordInvitationsResponse>
{
    private readonly IAppDbContext _dbContext;
    private readonly IIdentityService _identityService;
    private readonly ILogger<GetLandlordInvitationsQueryHandler> _logger;

    public GetLandlordInvitationsQueryHandler(
        IAppDbContext dbContext,
        IIdentityService identityService,
        ILogger<GetLandlordInvitationsQueryHandler> logger)
    {
        _dbContext = dbContext;
        _identityService = identityService;
        _logger = logger;
    }

    public async Task<GetLandlordInvitationsResponse> Handle(
        GetLandlordInvitationsQuery request, CancellationToken cancellationToken)
    {
        var invitations = await _dbContext.Invitations
            .Where(i => i.AccountId == null)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        // Resolve inviting-admin display names for the "Invited By" column.
        var inviterIds = invitations
            .Where(i => i.InvitedByUserId.HasValue)
            .Select(i => i.InvitedByUserId!.Value)
            .Distinct();
        var displayNames = await _identityService.GetUserDisplayNamesAsync(inviterIds, cancellationToken);

        var dtos = invitations.Select(i => new LandlordInvitationDto(
            i.Id,
            i.Email,
            i.CreatedAt,
            i.ExpiresAt,
            i.UsedAt,
            DeriveStatus(i),
            ResolveInvitedBy(i, displayNames))).ToList();

        _logger.LogInformation("Retrieved {Count} landlord invitations", dtos.Count);

        return new GetLandlordInvitationsResponse(dtos.AsReadOnly(), dtos.Count);
    }

    private static string ResolveInvitedBy(
        Domain.Entities.Invitation invitation, IReadOnlyDictionary<Guid, string> displayNames)
    {
        if (invitation.InvitedByUserId.HasValue
            && displayNames.TryGetValue(invitation.InvitedByUserId.Value, out var name))
        {
            return name;
        }

        return string.Empty;
    }

    private static string DeriveStatus(Domain.Entities.Invitation invitation)
    {
        if (invitation.UsedAt != null) return "Accepted";
        if (invitation.ExpiresAt < DateTime.UtcNow) return "Expired";
        return "Pending";
    }
}
