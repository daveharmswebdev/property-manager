using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Application.Auth;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Auth;

/// <summary>
/// Unit tests for RefreshTokenCommandHandler (Story 21.9 / AC-2).
/// </summary>
public class RefreshTokenCommandHandlerTests
{
    private readonly Mock<IJwtService> _jwtServiceMock;
    private readonly RefreshTokenCommandHandler _handler;
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testAccountId = Guid.NewGuid();
    private const string IncomingRefreshToken = "refresh.token";
    private const string Email = "dave@example.com";
    private const string Role = "Owner";

    public RefreshTokenCommandHandlerTests()
    {
        _jwtServiceMock = new Mock<IJwtService>();

        _handler = new RefreshTokenCommandHandler(
            _jwtServiceMock.Object,
            Mock.Of<ILogger<RefreshTokenCommandHandler>>());
    }

    [Fact]
    public async Task Handle_ValidRefreshToken_ReturnsNewAccessTokenAndNullNewRefreshToken()
    {
        // Arrange — AC-2.1
        _jwtServiceMock
            .Setup(x => x.ValidateRefreshTokenAsync(IncomingRefreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)_testUserId, (Guid?)_testAccountId, Role, Email, "Dave H.", (Guid?)null));

        _jwtServiceMock
            .Setup(x => x.GenerateAccessTokenAsync(
                _testUserId, _testAccountId, Role, Email, "Dave H.", (Guid?)null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(("new.access.jwt", 3600));

        var command = new RefreshTokenCommand(IncomingRefreshToken);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("new.access.jwt");
        result.ExpiresIn.Should().Be(3600);
        result.NewRefreshToken.Should().BeNull("rotation is disabled by default — RefreshToken.cs:74");

        _jwtServiceMock.Verify(
            x => x.GenerateAccessTokenAsync(
                _testUserId, _testAccountId, Role, Email, "Dave H.", (Guid?)null, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidRefreshToken_ThrowsUnauthorizedAccessException()
    {
        // Arrange — AC-2.2 — isValid = false
        _jwtServiceMock
            .Setup(x => x.ValidateRefreshTokenAsync(IncomingRefreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, (Guid?)null, (Guid?)null, (string?)null, (string?)null, (string?)null, (Guid?)null));

        var command = new RefreshTokenCommand(IncomingRefreshToken);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid or expired refresh token");

        _jwtServiceMock.Verify(
            x => x.GenerateAccessTokenAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_NullUserId_ThrowsUnauthorizedAccessException()
    {
        // Arrange — AC-2.3 — defensive null check at RefreshToken.cs:47
        _jwtServiceMock
            .Setup(x => x.ValidateRefreshTokenAsync(IncomingRefreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)null, (Guid?)_testAccountId, Role, Email, (string?)null, (Guid?)null));

        var command = new RefreshTokenCommand(IncomingRefreshToken);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid or expired refresh token");
    }

    [Fact]
    public async Task Handle_NullAccountId_ThrowsUnauthorizedAccessException()
    {
        // Arrange — AC-2.3
        _jwtServiceMock
            .Setup(x => x.ValidateRefreshTokenAsync(IncomingRefreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)_testUserId, (Guid?)null, Role, Email, (string?)null, (Guid?)null));

        var command = new RefreshTokenCommand(IncomingRefreshToken);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid or expired refresh token");
    }

    [Fact]
    public async Task Handle_NullRole_ThrowsUnauthorizedAccessException()
    {
        // Arrange — AC-2.3
        _jwtServiceMock
            .Setup(x => x.ValidateRefreshTokenAsync(IncomingRefreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)_testUserId, (Guid?)_testAccountId, (string?)null, Email, (string?)null, (Guid?)null));

        var command = new RefreshTokenCommand(IncomingRefreshToken);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid or expired refresh token");
    }

    [Fact]
    public async Task Handle_NullEmail_ThrowsUnauthorizedAccessException()
    {
        // Arrange — AC-2.3
        _jwtServiceMock
            .Setup(x => x.ValidateRefreshTokenAsync(IncomingRefreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)_testUserId, (Guid?)_testAccountId, Role, (string?)null, (string?)null, (Guid?)null));

        var command = new RefreshTokenCommand(IncomingRefreshToken);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid or expired refresh token");
    }
}
