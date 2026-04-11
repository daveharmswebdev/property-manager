using FluentAssertions;
using Moq;
using PropertyManager.Application.AccountUsers;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.AccountUsers;

/// <summary>
/// Unit tests for UpdateUserRoleCommandHandler (AC #2, #3).
/// </summary>
public class UpdateUserRoleHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly UpdateUserRoleCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _targetUserId = Guid.NewGuid();

    public UpdateUserRoleHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new UpdateUserRoleCommandHandler(_identityServiceMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRole_CallsIdentityService()
    {
        // Arrange — target user is a Contributor being promoted to Owner (no last-owner concern)
        var users = new List<AccountUserDto>
        {
            new(Guid.NewGuid(), "owner@test.com", "Owner", "Owner", DateTime.UtcNow, true),
            new(_targetUserId, "contrib@test.com", "Contrib", "Contributor", DateTime.UtcNow, false)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.UpdateUserRoleAsync(_targetUserId, _testAccountId, "Owner", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new UpdateUserRoleCommand(_targetUserId, "Owner");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _identityServiceMock.Verify(
            x => x.UpdateUserRoleAsync(_targetUserId, _testAccountId, "Owner", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_AccountCreatorDemotion_ThrowsValidationException()
    {
        // Arrange — account creator cannot be demoted regardless of owner count
        var ownerId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(ownerId, "owner@test.com", "Owner", "Owner", DateTime.UtcNow, true),
            new(Guid.NewGuid(), "owner2@test.com", "Owner 2", "Owner", DateTime.UtcNow, false)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        var command = new UpdateUserRoleCommand(ownerId, "Contributor");

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*Cannot change the account creator's role*");
    }

    [Fact]
    public async Task Handle_LastOwnerDemotion_ThrowsValidationException()
    {
        // Arrange — only 1 owner (non-creator) in account, trying to demote to Contributor
        var ownerId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(ownerId, "owner@test.com", "Owner", "Owner", DateTime.UtcNow, false)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.CountOwnersInAccountAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateUserRoleCommand(ownerId, "Contributor");

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*Cannot remove the last owner from the account*");
    }

    [Fact]
    public async Task Handle_DemoteOwnerWithMultipleOwners_Succeeds()
    {
        // Arrange — 2 owners, demoting non-creator to Contributor is fine
        var ownerId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(Guid.NewGuid(), "owner1@test.com", "Owner 1", "Owner", DateTime.UtcNow, true),
            new(ownerId, "owner2@test.com", "Owner 2", "Owner", DateTime.UtcNow, false)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.CountOwnersInAccountAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);
        _identityServiceMock
            .Setup(x => x.UpdateUserRoleAsync(ownerId, _testAccountId, "Contributor", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new UpdateUserRoleCommand(ownerId, "Contributor");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _identityServiceMock.Verify(
            x => x.UpdateUserRoleAsync(ownerId, _testAccountId, "Contributor", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_UserNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var users = new List<AccountUserDto>
        {
            new(Guid.NewGuid(), "owner@test.com", "Owner", "Owner", DateTime.UtcNow, true)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.UpdateUserRoleAsync(_targetUserId, _testAccountId, "Owner", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "User not found"));

        var command = new UpdateUserRoleCommand(_targetUserId, "Owner");

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }
}
