using FluentAssertions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Invitations;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Invitations;

/// <summary>
/// Unit tests for AcceptInvitationCommandHandler (AC: #2, #3, #4, #5).
/// </summary>
public class AcceptInvitationTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IIdentityService> _mockIdentityService;
    private readonly Mock<ILogger<AcceptInvitationCommandHandler>> _mockLogger;
    private readonly AcceptInvitationCommandHandler _handler;

    private readonly Guid _existingAccountId = Guid.NewGuid();
    private readonly Guid _createdUserId = Guid.NewGuid();

    public AcceptInvitationTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockIdentityService = new Mock<IIdentityService>();
        _mockLogger = new Mock<ILogger<AcceptInvitationCommandHandler>>();

        _handler = new AcceptInvitationCommandHandler(
            _mockDbContext.Object,
            _mockIdentityService.Object,
            _mockLogger.Object);
    }

    private Invitation CreateValidInvitation(Guid? accountId = null, string role = "Owner")
    {
        // Compute a known code hash for testing
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes("test-code"));
        var codeHash = Convert.ToBase64String(hashBytes);

        return new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "invitee@example.com",
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23),
            UsedAt = null,
            AccountId = accountId,
            Role = role
        };
    }

    private void SetupInvitationDbSet(List<Invitation> invitations)
    {
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
    }

    private void SetupAccountDbSet()
    {
        var accounts = new List<Account>();
        var mockAccountSet = accounts.BuildMockDbSet();
        mockAccountSet.Setup(x => x.Add(It.IsAny<Account>())).Callback<Account>(a =>
        {
            a.Id = Guid.NewGuid();
            accounts.Add(a);
        });
        _mockDbContext.Setup(x => x.Accounts).Returns(mockAccountSet.Object);
    }

    private void SetupIdentitySuccess()
    {
        _mockIdentityService.Setup(x => x.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockIdentityService.Setup(x => x.CreateUserWithConfirmedEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((_createdUserId, Enumerable.Empty<string>()));
    }

    [Fact]
    public async Task Handle_InvitationWithAccountId_JoinsExistingAccount()
    {
        // Arrange — AC: #2 — user joins inviter's account
        var invitation = CreateValidInvitation(accountId: _existingAccountId, role: "Owner");
        SetupInvitationDbSet(new List<Invitation> { invitation });
        SetupIdentitySuccess();
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "NewUser@123456");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.UserId.Should().Be(_createdUserId);
        result.Message.Should().Contain("joined account");

        // Verify CreateUserWithConfirmedEmailAsync was called with the EXISTING accountId
        _mockIdentityService.Verify(x => x.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            "NewUser@123456",
            _existingAccountId,
            "Owner",
            It.IsAny<Guid?>(),
            It.IsAny<CancellationToken>()), Times.Once);

        // Verify NO new Account was added
        _mockDbContext.Verify(x => x.Accounts, Times.Never);
    }

    [Fact]
    public async Task Handle_InvitationWithContributorRole_CreatesUserWithContributorRole()
    {
        // Arrange — AC: #3 — Contributor role is passed through
        var invitation = CreateValidInvitation(accountId: _existingAccountId, role: "Contributor");
        SetupInvitationDbSet(new List<Invitation> { invitation });
        SetupIdentitySuccess();
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "NewUser@123456");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _mockIdentityService.Verify(x => x.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            "NewUser@123456",
            _existingAccountId,
            "Contributor",
            It.IsAny<Guid?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvitationWithoutAccountId_CreatesNewAccount()
    {
        // Arrange — AC: #5 — legacy path creates new account with Owner role
        var invitation = CreateValidInvitation(accountId: null, role: "Owner");
        SetupInvitationDbSet(new List<Invitation> { invitation });
        SetupAccountDbSet();
        SetupIdentitySuccess();
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "NewUser@123456");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.UserId.Should().Be(_createdUserId);
        result.Message.Should().Contain("Account created");

        // Verify a new Account was added
        _mockDbContext.Verify(x => x.Accounts, Times.AtLeastOnce);

        // Verify identity was called with "Owner" role
        _mockIdentityService.Verify(x => x.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            "NewUser@123456",
            It.IsAny<Guid>(),
            "Owner",
            It.IsAny<Guid?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvitationWithAccountId_DoesNotRollbackOnUserCreationFailure()
    {
        // Arrange — when joining existing account, no rollback needed
        var invitation = CreateValidInvitation(accountId: _existingAccountId, role: "Owner");
        SetupInvitationDbSet(new List<Invitation> { invitation });
        _mockIdentityService.Setup(x => x.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockIdentityService.Setup(x => x.CreateUserWithConfirmedEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(((Guid?)null, new[] { "Password too weak" }));
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "weak");

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>();

        // Verify Accounts.Remove was never called (no rollback for existing account)
        _mockDbContext.Verify(x => x.Accounts, Times.Never);
    }

    [Fact]
    public async Task Handle_InvitationWithoutAccountId_RollsBackNewAccountOnUserCreationFailure()
    {
        // Arrange — legacy path should rollback new account on failure
        var invitation = CreateValidInvitation(accountId: null, role: "Owner");
        SetupInvitationDbSet(new List<Invitation> { invitation });

        var accounts = new List<Account>();
        var mockAccountSet = accounts.BuildMockDbSet();
        mockAccountSet.Setup(x => x.Add(It.IsAny<Account>())).Callback<Account>(a =>
        {
            a.Id = Guid.NewGuid();
            accounts.Add(a);
        });
        mockAccountSet.Setup(x => x.Remove(It.IsAny<Account>())).Callback<Account>(a => accounts.Remove(a));
        _mockDbContext.Setup(x => x.Accounts).Returns(mockAccountSet.Object);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockIdentityService.Setup(x => x.CreateUserWithConfirmedEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(((Guid?)null, new[] { "Password too weak" }));
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "weak");

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>();

        // Account was added then removed (rollback)
        mockAccountSet.Verify(x => x.Remove(It.IsAny<Account>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvitationMarkedAsUsed_AfterSuccessfulAcceptance()
    {
        // Arrange
        var invitation = CreateValidInvitation(accountId: _existingAccountId, role: "Owner");
        SetupInvitationDbSet(new List<Invitation> { invitation });
        SetupIdentitySuccess();
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "NewUser@123456");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        invitation.UsedAt.Should().NotBeNull();
        _mockDbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // === Story 20.2 Tests ===

    [Fact]
    public async Task Handle_InvitationWithPropertyId_PassesPropertyIdToCreateUser()
    {
        // Arrange — AC: 20.2 #2 — tenant invitation passes PropertyId to user creation
        var propertyId = Guid.NewGuid();
        var invitation = CreateValidInvitation(accountId: _existingAccountId, role: "Tenant");
        invitation.PropertyId = propertyId;

        SetupInvitationDbSet(new List<Invitation> { invitation });
        SetupIdentitySuccess();
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "NewUser@123456");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.UserId.Should().Be(_createdUserId);
        _mockIdentityService.Verify(x => x.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            "NewUser@123456",
            _existingAccountId,
            "Tenant",
            propertyId,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvitationWithoutPropertyId_PassesNullPropertyId()
    {
        // Arrange — AC: 20.2 — Owner/Contributor invitations have null PropertyId
        var invitation = CreateValidInvitation(accountId: _existingAccountId, role: "Owner");
        // invitation.PropertyId is null by default

        SetupInvitationDbSet(new List<Invitation> { invitation });
        SetupIdentitySuccess();
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new AcceptInvitationCommand("test-code", "NewUser@123456");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _mockIdentityService.Verify(x => x.CreateUserWithConfirmedEmailAsync(
            invitation.Email,
            "NewUser@123456",
            _existingAccountId,
            "Owner",
            null,
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
