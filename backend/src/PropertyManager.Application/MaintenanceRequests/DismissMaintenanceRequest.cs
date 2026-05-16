using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// Command for dismissing a maintenance request (Story 20.9, AC #6).
/// Sets <see cref="MaintenanceRequest.DismissalReason"/> and transitions
/// the status from <c>Submitted</c> to <c>Dismissed</c>. Single SaveChanges,
/// no explicit transaction — see Story 20.9 Dev Notes for the rationale.
/// </summary>
public record DismissMaintenanceRequestCommand(
    Guid MaintenanceRequestId,
    string Reason
) : IRequest<Unit>;

/// <summary>
/// Handler for <see cref="DismissMaintenanceRequestCommand"/>.
/// <para>
/// Loads the maintenance request scoped to the current user's account, sets the
/// dismissal reason (trimmed), then calls <see cref="MaintenanceRequest.TransitionTo"/>
/// which enforces the <c>Submitted → Dismissed</c> rule (any other source status
/// throws <see cref="BusinessRuleException"/>, mapped to 400 by global middleware).
/// </para>
/// </summary>
public class DismissMaintenanceRequestCommandHandler
    : IRequestHandler<DismissMaintenanceRequestCommand, Unit>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<DismissMaintenanceRequestCommandHandler> _logger;

    public DismissMaintenanceRequestCommandHandler(
        IAppDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<DismissMaintenanceRequestCommandHandler> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<Unit> Handle(
        DismissMaintenanceRequestCommand request,
        CancellationToken cancellationToken)
    {
        // Load the maintenance request (no Include — we don't touch photos or work orders).
        // Global query filter scopes by account; the explicit AccountId predicate is
        // belt-and-suspenders for cross-account isolation (AC #13).
        var maintenanceRequest = await _dbContext.MaintenanceRequests
            .FirstOrDefaultAsync(
                mr => mr.Id == request.MaintenanceRequestId
                    && mr.AccountId == _currentUser.AccountId
                    && mr.DeletedAt == null,
                cancellationToken);

        if (maintenanceRequest == null)
        {
            throw new NotFoundException(nameof(MaintenanceRequest), request.MaintenanceRequestId);
        }

        // Mutate in memory. If TransitionTo throws (BusinessRuleException for any source
        // status != Submitted), SaveChangesAsync is never called and the in-memory
        // DismissalReason mutation is discarded — no rollback needed (AC #10).
        maintenanceRequest.DismissalReason = request.Reason.Trim();
        maintenanceRequest.TransitionTo(MaintenanceRequestStatus.Dismissed);

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Log after the save. Never log the reason text itself — could contain PII.
        _logger.LogInformation(
            "Dismissed maintenance request {RequestId} with reason length {ReasonLength}",
            maintenanceRequest.Id,
            maintenanceRequest.DismissalReason!.Length);

        return Unit.Value;
    }
}
