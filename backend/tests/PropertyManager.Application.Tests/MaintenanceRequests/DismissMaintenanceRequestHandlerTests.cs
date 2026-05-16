using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequests;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for <see cref="DismissMaintenanceRequestCommandHandler"/>
/// (Story 20.9, AC #6, #10, #13, #14).
/// </summary>
public class DismissMaintenanceRequestHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly DismissMaintenanceRequestCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public DismissMaintenanceRequestHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new DismissMaintenanceRequestCommandHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            Mock.Of<ILogger<DismissMaintenanceRequestCommandHandler>>());
    }

    // ──────────────────────────────────────────────────────────────────
    // AC #6 — happy path
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ValidSubmittedRequest_SetsDismissalReasonAndTransitionsStatus()
    {
        var requestId = Guid.NewGuid();
        var entity = SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.Submitted);

        var command = new DismissMaintenanceRequestCommand(requestId, "Tenant moved out");

        await _handler.Handle(command, CancellationToken.None);

        entity.DismissalReason.Should().Be("Tenant moved out");
        entity.Status.Should().Be(MaintenanceRequestStatus.Dismissed);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_TrimsReason()
    {
        var requestId = Guid.NewGuid();
        var entity = SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.Submitted);

        var command = new DismissMaintenanceRequestCommand(requestId, "  Tenant moved out  ");

        await _handler.Handle(command, CancellationToken.None);

        entity.DismissalReason.Should().Be("Tenant moved out");
    }

    [Fact]
    public async Task Handle_PersistsExactlyOneSaveChanges()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.Submitted);

        var command = new DismissMaintenanceRequestCommand(requestId, "Some reason");

        await _handler.Handle(command, CancellationToken.None);

        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ──────────────────────────────────────────────────────────────────
    // AC #13 / #14 — not-found
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_RequestNotFound_ThrowsNotFoundException()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequests(new List<MaintenanceRequest>());

        var command = new DismissMaintenanceRequestCommand(requestId, "Reason");

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*MaintenanceRequest*{requestId}*");
    }

    [Fact]
    public async Task Handle_RequestFromOtherAccount_ThrowsNotFoundException()
    {
        var requestId = Guid.NewGuid();
        var otherAccountId = Guid.NewGuid();
        // Seed an MR scoped to a different account; the AccountId predicate excludes it.
        SetupMaintenanceRequest(requestId, otherAccountId, MaintenanceRequestStatus.Submitted);

        var command = new DismissMaintenanceRequestCommand(requestId, "Reason");

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*MaintenanceRequest*{requestId}*");
    }

    // ──────────────────────────────────────────────────────────────────
    // AC #10 — state machine enforcement
    // ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_RequestInProgress_ThrowsBusinessRuleException()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.InProgress);

        var command = new DismissMaintenanceRequestCommand(requestId, "Reason");

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*InProgress*");
    }

    [Fact]
    public async Task Handle_RequestResolved_ThrowsBusinessRuleException()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.Resolved);

        var command = new DismissMaintenanceRequestCommand(requestId, "Reason");

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*Resolved*");
    }

    [Fact]
    public async Task Handle_RequestDismissed_ThrowsBusinessRuleException()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.Dismissed);

        var command = new DismissMaintenanceRequestCommand(requestId, "Reason");

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*Dismissed*");
    }

    [Fact]
    public async Task Handle_BusinessRuleException_DoesNotPersist()
    {
        var requestId = Guid.NewGuid();
        SetupMaintenanceRequest(requestId, _testAccountId, MaintenanceRequestStatus.InProgress);

        var command = new DismissMaintenanceRequestCommand(requestId, "Reason");

        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<BusinessRuleException>();

        _dbContextMock.Verify(
            x => x.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // ──────────────────────────────────────────────────────────────────
    // Setup helpers
    // ──────────────────────────────────────────────────────────────────

    private MaintenanceRequest SetupMaintenanceRequest(
        Guid id,
        Guid accountId,
        MaintenanceRequestStatus status)
    {
        var entity = new MaintenanceRequest
        {
            Id = id,
            AccountId = accountId,
            PropertyId = _testPropertyId,
            SubmittedByUserId = _testUserId,
            Description = "seeded",
            Status = status,
            DeletedAt = null,
            Photos = new List<MaintenanceRequestPhoto>(),
        };
        SetupMaintenanceRequests(new List<MaintenanceRequest> { entity });
        return entity;
    }

    private void SetupMaintenanceRequests(List<MaintenanceRequest> requests)
    {
        var mockDbSet = requests.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }
}
