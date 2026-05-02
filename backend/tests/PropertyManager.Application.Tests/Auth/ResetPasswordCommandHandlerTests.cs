using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Application.Auth;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Auth;

/// <summary>
/// Unit tests for ResetPasswordCommandHandler (Story 21.9 / AC-5).
/// Token format: Base64(userId:innerToken). Session revoke runs only when token decodes
/// to a valid (Guid, _) pair AND identity reset succeeded.
/// </summary>
public class ResetPasswordCommandHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<IJwtService> _jwtServiceMock;
    private readonly ResetPasswordCommandHandler _handler;

    public ResetPasswordCommandHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _jwtServiceMock = new Mock<IJwtService>();

        _handler = new ResetPasswordCommandHandler(
            _identityServiceMock.Object,
            _jwtServiceMock.Object,
            Mock.Of<ILogger<ResetPasswordCommandHandler>>());
    }

    private static string BuildValidToken(Guid userId)
        => Convert.ToBase64String(Encoding.UTF8.GetBytes($"{userId}:inner"));

    [Fact]
    public async Task Handle_ValidTokenAndIdentitySuccess_RevokesAllSessionsAndReturnsSuccess()
    {
        // Arrange — AC-5.1
        var userId = Guid.NewGuid();
        var token = BuildValidToken(userId);

        _identityServiceMock
            .Setup(x => x.ResetPasswordAsync(token, "NewPw1!", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new ResetPasswordCommand(token, "NewPw1!");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.ErrorMessage.Should().BeNull();

        _jwtServiceMock.Verify(
            x => x.RevokeAllUserRefreshTokensAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_IdentityFailure_DoesNotRevokeSessionsAndReturnsFailure()
    {
        // Arrange — AC-5.2
        var userId = Guid.NewGuid();
        var token = BuildValidToken(userId);

        _identityServiceMock
            .Setup(x => x.ResetPasswordAsync(token, "NewPw1!", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "Invalid token"));

        var command = new ResetPasswordCommand(token, "NewPw1!");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Be("Invalid token");

        _jwtServiceMock.Verify(
            x => x.RevokeAllUserRefreshTokensAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_MalformedBase64Token_SuccessButSkipsSessionRevoke()
    {
        // Arrange — AC-5.3 — ExtractUserIdFromToken catches FormatException and returns null
        const string token = "this-is-not-base64!";

        _identityServiceMock
            .Setup(x => x.ResetPasswordAsync(token, "NewPw1!", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new ResetPasswordCommand(token, "NewPw1!");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();

        _jwtServiceMock.Verify(
            x => x.RevokeAllUserRefreshTokensAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_TokenWithoutColonSeparator_SuccessButSkipsSessionRevoke()
    {
        // Arrange — AC-5.4 — well-formed Base64 but parts.Length != 2
        var token = Convert.ToBase64String(Encoding.UTF8.GetBytes("no-colon-here"));

        _identityServiceMock
            .Setup(x => x.ResetPasswordAsync(token, "NewPw1!", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new ResetPasswordCommand(token, "NewPw1!");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();

        _jwtServiceMock.Verify(
            x => x.RevokeAllUserRefreshTokensAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
