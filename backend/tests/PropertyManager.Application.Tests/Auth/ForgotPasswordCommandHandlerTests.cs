using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Application.Auth;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Auth;

/// <summary>
/// Unit tests for ForgotPasswordCommandHandler (Story 21.9 / AC-4).
/// Anti-enumeration: handler always returns Success=true regardless of branch.
/// </summary>
public class ForgotPasswordCommandHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly ForgotPasswordCommandHandler _handler;

    public ForgotPasswordCommandHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _emailServiceMock = new Mock<IEmailService>();

        _handler = new ForgotPasswordCommandHandler(
            _identityServiceMock.Object,
            _emailServiceMock.Object,
            Mock.Of<ILogger<ForgotPasswordCommandHandler>>());
    }

    [Fact]
    public async Task Handle_KnownEmail_GeneratesTokenAndSendsEmail_ReturnsSuccess()
    {
        // Arrange — AC-4.1
        const string email = "user@example.com";
        var userId = Guid.NewGuid();

        _identityServiceMock
            .Setup(x => x.GetUserIdByEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid?)userId);
        _identityServiceMock
            .Setup(x => x.GeneratePasswordResetTokenAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync("reset.token.value");

        var command = new ForgotPasswordCommand(email);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();

        _emailServiceMock.Verify(
            x => x.SendPasswordResetEmailAsync(email, "reset.token.value", It.IsAny<CancellationToken>()),
            Times.Once);
        _identityServiceMock.Verify(
            x => x.GeneratePasswordResetTokenAsync(userId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_UnknownEmail_DoesNotGenerateTokenOrSendEmail_StillReturnsSuccess()
    {
        // Arrange — AC-4.2 — anti-enumeration (ForgotPassword.cs:78-79)
        const string email = "nobody@example.com";

        _identityServiceMock
            .Setup(x => x.GetUserIdByEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid?)null);

        var command = new ForgotPasswordCommand(email);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue("anti-enumeration — caller cannot tell whether email exists");

        _identityServiceMock.Verify(
            x => x.GeneratePasswordResetTokenAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _emailServiceMock.Verify(
            x => x.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_EmailServiceThrows_PropagatesException()
    {
        // Arrange — AC-4.3 — handler does NOT swallow email failures (no try/catch)
        const string email = "user@example.com";
        var userId = Guid.NewGuid();

        _identityServiceMock
            .Setup(x => x.GetUserIdByEmailAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid?)userId);
        _identityServiceMock
            .Setup(x => x.GeneratePasswordResetTokenAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync("reset.token.value");
        _emailServiceMock
            .Setup(x => x.SendPasswordResetEmailAsync(email, "reset.token.value", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("SMTP unreachable"));

        var command = new ForgotPasswordCommand(email);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*SMTP unreachable*");
    }
}
