using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Application.Auth;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Application.Tests.Auth;

/// <summary>
/// Unit tests for LoginCommandHandler (Story 21.9 / AC-1).
/// </summary>
public class LoginCommandHandlerTests
{
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<IJwtService> _jwtServiceMock;
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly LoginCommandHandler _handler;
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testAccountId = Guid.NewGuid();

    public LoginCommandHandlerTests()
    {
        _identityServiceMock = new Mock<IIdentityService>();
        _jwtServiceMock = new Mock<IJwtService>();
        _dbContextMock = new Mock<IAppDbContext>();

        _handler = new LoginCommandHandler(
            _identityServiceMock.Object,
            _jwtServiceMock.Object,
            _dbContextMock.Object,
            Mock.Of<ILogger<LoginCommandHandler>>());
    }

    [Fact]
    public async Task Handle_ValidCredentials_ReturnsTokensAndCallsJwtServices()
    {
        // Arrange — AC-1.1
        const string email = "dave@example.com";
        const string displayName = "Dave H.";
        const string role = "Owner";

        _identityServiceMock
            .Setup(x => x.ValidateCredentialsAsync(email, "Pw1!", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)_testUserId, (Guid?)_testAccountId, role, email, displayName, (Guid?)null, (string?)null));

        _jwtServiceMock
            .Setup(x => x.GenerateAccessTokenAsync(
                _testUserId, _testAccountId, role, email, displayName, (Guid?)null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(("access.jwt", 3600));

        _jwtServiceMock
            .Setup(x => x.GenerateRefreshTokenAsync(_testUserId, _testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync("refresh.token");

        var command = new LoginCommand(email, "Pw1!");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("access.jwt");
        result.ExpiresIn.Should().Be(3600);
        result.RefreshToken.Should().Be("refresh.token");
        result.UserId.Should().Be(_testUserId);
        result.AccountId.Should().Be(_testAccountId);
        result.Role.Should().Be(role);

        _jwtServiceMock.Verify(
            x => x.GenerateAccessTokenAsync(
                _testUserId, _testAccountId, role, email, displayName, (Guid?)null, It.IsAny<CancellationToken>()),
            Times.Once);
        _jwtServiceMock.Verify(
            x => x.GenerateRefreshTokenAsync(_testUserId, _testAccountId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidCredentials_ThrowsUnauthorizedAccessException_WithIdentityErrorMessage()
    {
        // Arrange — AC-1.2
        _identityServiceMock
            .Setup(x => x.ValidateCredentialsAsync("bad@example.com", "wrong", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, (Guid?)null, (Guid?)null, (string?)null, (string?)null, (string?)null, (Guid?)null, "Invalid email or password"));

        var command = new LoginCommand("bad@example.com", "wrong");

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid email or password");

        _jwtServiceMock.Verify(
            x => x.GenerateAccessTokenAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _jwtServiceMock.Verify(
            x => x.GenerateRefreshTokenAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_InvalidCredentials_NullErrorMessage_ThrowsUnauthorizedAccessException_WithFallback()
    {
        // Arrange — AC-1.3 — exercise the `?? "Invalid email or password"` fallback at Login.cs:83
        _identityServiceMock
            .Setup(x => x.ValidateCredentialsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, (Guid?)null, (Guid?)null, (string?)null, (string?)null, (string?)null, (Guid?)null, (string?)null));

        var command = new LoginCommand("bad@example.com", "wrong");

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Invalid email or password");
    }

    [Fact]
    public async Task Handle_TenantRoleWithPropertyId_PassesPropertyIdToAccessTokenGeneration()
    {
        // Arrange — AC-1.4
        var propertyId = Guid.NewGuid();
        const string email = "tenant@example.com";
        const string role = "Tenant";

        _identityServiceMock
            .Setup(x => x.ValidateCredentialsAsync(email, "Pw1!", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, (Guid?)_testUserId, (Guid?)_testAccountId, role, email, (string?)null, (Guid?)propertyId, (string?)null));

        _jwtServiceMock
            .Setup(x => x.GenerateAccessTokenAsync(
                _testUserId, _testAccountId, role, email, It.IsAny<string?>(), (Guid?)propertyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(("access.jwt", 3600));

        _jwtServiceMock
            .Setup(x => x.GenerateRefreshTokenAsync(_testUserId, _testAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync("refresh.token");

        var command = new LoginCommand(email, "Pw1!");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert — propertyId for tenant flows through to the JWT generation call
        _jwtServiceMock.Verify(
            x => x.GenerateAccessTokenAsync(
                _testUserId, _testAccountId, role, email, It.IsAny<string?>(), (Guid?)propertyId, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
