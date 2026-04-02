using FluentAssertions;
using Moq;
using PropertyManager.Application.AccountUsers;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.AccountUsers;

/// <summary>
/// Unit tests for GetAccountUsersQueryHandler (AC #1).
/// </summary>
public class GetAccountUsersHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetAccountUsersQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public GetAccountUsersHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);

        _handler = new GetAccountUsersQueryHandler(_identityServiceMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ReturnsUsersFromIdentityService()
    {
        // Arrange
        var users = new List<AccountUserDto>
        {
            new(Guid.NewGuid(), "owner@test.com", "Owner User", "Owner", DateTime.UtcNow),
            new(Guid.NewGuid(), "contrib@test.com", "Contributor User", "Contributor", DateTime.UtcNow)
        };
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        // Act
        var result = await _handler.Handle(new GetAccountUsersQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items[0].Email.Should().Be("owner@test.com");
        result.Items[1].Email.Should().Be("contrib@test.com");
        _identityServiceMock.Verify(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NoUsers_ReturnsEmptyList()
    {
        // Arrange
        _identityServiceMock
            .Setup(x => x.GetAccountUsersAsync(_testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AccountUserDto>());

        // Act
        var result = await _handler.Handle(new GetAccountUsersQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }
}
