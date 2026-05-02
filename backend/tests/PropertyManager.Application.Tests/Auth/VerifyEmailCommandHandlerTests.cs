using FluentAssertions;
using Moq;
using PropertyManager.Application.Auth;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Auth;

/// <summary>
/// Unit tests for VerifyEmailCommandHandler (Story 21.9 / AC-6).
/// The handler is a thin passthrough — its sole job is to forward to IIdentityService.
/// Note: this handler does NOT inject ILogger (verified VerifyEmail.cs:35-40).
/// </summary>
public class VerifyEmailCommandHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly VerifyEmailCommandHandler _handler;

    public VerifyEmailCommandHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _handler = new VerifyEmailCommandHandler(_identityServiceMock.Object);
    }

    [Fact]
    public async Task Handle_ValidToken_ReturnsSuccessResult()
    {
        // Arrange — AC-6.1
        const string token = "vtoken";

        _identityServiceMock
            .Setup(x => x.VerifyEmailAsync(token, It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (string?)null));

        var command = new VerifyEmailCommand(token);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.ErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task Handle_InvalidToken_PassesIdentityErrorMessageThrough()
    {
        // Arrange — AC-6.2 — handler does not transform the error
        const string token = "bad.token";

        _identityServiceMock
            .Setup(x => x.VerifyEmailAsync(token, It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "Invalid verification token"));

        var command = new VerifyEmailCommand(token);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Be("Invalid verification token");
    }
}
