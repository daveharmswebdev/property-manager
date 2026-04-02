using FluentAssertions;
using Moq;
using PropertyManager.Application.AccountUsers;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.AccountUsers;

/// <summary>
/// Unit tests for RemoveAccountUserCommandHandler (AC #4, #3).
/// </summary>
public class RemoveAccountUserHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly RemoveAccountUserCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public RemoveAccountUserHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new RemoveAccountUserCommandHandler(_identityServiceMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidUser_CallsRemoveFromAccount()
    {
        // Arrange
        var contributorId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(Guid.NewGuid(), "owner@test.com", "Owner", "Owner", DateTime.UtcNow),
            new(contributorId, "contrib@test.com", "Contributor", "Contributor", DateTime.UtcNow)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.RemoveUserFromAccountAsync(contributorId, _testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new RemoveAccountUserCommand(contributorId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _identityServiceMock.Verify(
            x => x.RemoveUserFromAccountAsync(contributorId, _testAccountId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_LastOwner_ThrowsValidationException()
    {
        // Arrange — only 1 owner, trying to remove them
        var ownerId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(ownerId, "owner@test.com", "Owner", "Owner", DateTime.UtcNow)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.CountOwnersInAccountAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new RemoveAccountUserCommand(ownerId);

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*Cannot remove the last owner from the account*");
    }

    [Fact]
    public async Task Handle_UserNotFound_ThrowsNotFoundException()
    {
        // Arrange — target user doesn't exist in account
        var nonExistentUserId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(Guid.NewGuid(), "owner@test.com", "Owner", "Owner", DateTime.UtcNow)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        var command = new RemoveAccountUserCommand(nonExistentUserId);

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_RemoveOwnerWithMultipleOwners_Succeeds()
    {
        // Arrange — 2 owners, removing one is fine
        var ownerId = Guid.NewGuid();
        var users = new List<AccountUserDto>
        {
            new(ownerId, "owner1@test.com", "Owner 1", "Owner", DateTime.UtcNow),
            new(Guid.NewGuid(), "owner2@test.com", "Owner 2", "Owner", DateTime.UtcNow)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);
        _identityServiceMock
            .Setup(x => x.CountOwnersInAccountAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);
        _identityServiceMock
            .Setup(x => x.RemoveUserFromAccountAsync(ownerId, _testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new RemoveAccountUserCommand(ownerId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _identityServiceMock.Verify(
            x => x.RemoveUserFromAccountAsync(ownerId, _testAccountId, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
