using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Application.Auth;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Auth;

/// <summary>
/// Unit tests for LogoutCommandHandler (Story 21.9 / AC-3).
/// </summary>
public class LogoutCommandHandlerTests
{
    private readonly Mock<IJwtService> _jwtServiceMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly LogoutCommandHandler _handler;
    private readonly Guid _testUserId = Guid.NewGuid();

    public LogoutCommandHandlerTests()
    {
        _jwtServiceMock = new Mock<IJwtService>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        _handler = new LogoutCommandHandler(
            _jwtServiceMock.Object,
            _currentUserMock.Object,
            Mock.Of<ILogger<LogoutCommandHandler>>());
    }

    [Fact]
    public async Task Handle_RefreshTokenProvided_RevokesTokenAndReturnsSuccess()
    {
        // Arrange — AC-3.1
        var command = new LogoutCommand("abc");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();

        _jwtServiceMock.Verify(
            x => x.RevokeRefreshTokenAsync("abc", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_NullRefreshToken_DoesNotRevokeAndReturnsSuccess()
    {
        // Arrange — AC-3.2 — idempotent (Logout.cs:46-47)
        var command = new LogoutCommand(null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();

        _jwtServiceMock.Verify(
            x => x.RevokeRefreshTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_WhitespaceRefreshToken_DoesNotRevokeAndReturnsSuccess()
    {
        // Arrange — AC-3.3 — string.IsNullOrWhiteSpace branch
        var command = new LogoutCommand("   ");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();

        _jwtServiceMock.Verify(
            x => x.RevokeRefreshTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
