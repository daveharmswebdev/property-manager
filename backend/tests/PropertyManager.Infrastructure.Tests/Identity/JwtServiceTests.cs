using System.IdentityModel.Tokens.Jwt;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Moq;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Identity;

namespace PropertyManager.Infrastructure.Tests.Identity;

/// <summary>
/// Unit tests for JwtService - verifying email and displayName claims (AC-7.2.1, AC-7.2.2).
/// </summary>
public class JwtServiceTests
{
    private readonly JwtSettings _settings;
    private readonly JwtService _jwtService;

    public JwtServiceTests()
    {
        _settings = new JwtSettings
        {
            Secret = "ThisIsATestSecretKeyThatIsAtLeast32CharactersLong!",
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            AccessTokenExpiryMinutes = 60,
            RefreshTokenExpiryDays = 7
        };

        var options = Options.Create(_settings);

        // Note: DbContext and UserManager are null/mocked because GenerateAccessTokenAsync
        // doesn't use them. Only refresh token operations require the database/UserManager.
        var userManagerMock = new Mock<UserManager<ApplicationUser>>(
            Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);
        _jwtService = new JwtService(options, null!, userManagerMock.Object);
    }

    [Fact]
    public async Task GenerateAccessToken_IncludesEmailClaim()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var role = "Owner";
        var email = "test@example.com";
        string? displayName = "Test User";

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, propertyId: null, cancellationToken: CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().Contain(c => c.Type == "email" && c.Value == email);
    }

    [Fact]
    public async Task GenerateAccessToken_IncludesDisplayNameClaim_WhenProvided()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var role = "Owner";
        var email = "test@example.com";
        var displayName = "John Doe";

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, propertyId: null, cancellationToken: CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().Contain(c => c.Type == "displayName" && c.Value == displayName);
    }

    [Fact]
    public async Task GenerateAccessToken_OmitsDisplayNameClaim_WhenNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var role = "Owner";
        var email = "test@example.com";
        string? displayName = null;

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, propertyId: null, cancellationToken: CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        // displayName claim should be omitted when null is passed
        token.Claims.Should().NotContain(c => c.Type == "displayName");
    }

    [Fact]
    public async Task GenerateAccessToken_IncludesAllRequiredClaims()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var role = "Owner";
        var email = "test@example.com";
        var displayName = "John Doe";

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, propertyId: null, cancellationToken: CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().Contain(c => c.Type == "userId" && c.Value == userId.ToString());
        token.Claims.Should().Contain(c => c.Type == "accountId" && c.Value == accountId.ToString());
        token.Claims.Should().Contain(c => c.Type == "role" && c.Value == role);
        token.Claims.Should().Contain(c => c.Type == "email" && c.Value == email);
        token.Claims.Should().Contain(c => c.Type == "displayName" && c.Value == displayName);
    }

    [Fact]
    public async Task GenerateAccessToken_IncludesPropertyIdClaim_WhenProvided()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var role = "Tenant";
        var email = "tenant@example.com";
        string? displayName = "Tenant User";

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, propertyId: propertyId, cancellationToken: CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().Contain(c => c.Type == "propertyId" && c.Value == propertyId.ToString());
    }

    [Fact]
    public async Task GenerateAccessToken_OmitsPropertyIdClaim_WhenNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var role = "Owner";
        var email = "owner@example.com";
        string? displayName = "Owner User";

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, propertyId: null, cancellationToken: CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().NotContain(c => c.Type == "propertyId");
    }

    // ===== Story 22.1 — PlatformAdmin claim emission tests (AC #3) =====

    [Fact]
    public async Task GenerateAccessToken_WhenIsPlatformAdminTrue_IncludesPlatformAdminClaim()
    {
        // Arrange — Story 22.1 AC #3
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, "Owner", "admin@example.com", "Admin User",
            propertyId: null, isPlatformAdmin: true, cancellationToken: CancellationToken.None);

        // Assert — claim is present and value is the literal string "true"
        var token = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
        token.Claims.Should().Contain(c => c.Type == "platformAdmin" && c.Value == "true");
    }

    [Fact]
    public async Task GenerateAccessToken_WhenIsPlatformAdminFalse_OmitsPlatformAdminClaim()
    {
        // Arrange — Story 22.1 AC #3 (negative case — claim must be ABSENT, not "false")
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, "Owner", "user@example.com", "Regular User",
            propertyId: null, isPlatformAdmin: false, cancellationToken: CancellationToken.None);

        // Assert
        var token = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
        token.Claims.Should().NotContain(c => c.Type == "platformAdmin");
    }
}
