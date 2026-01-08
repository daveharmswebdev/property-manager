using System.IdentityModel.Tokens.Jwt;
using FluentAssertions;
using Microsoft.Extensions.Options;
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

        // Note: DbContext is null because GenerateAccessTokenAsync doesn't use it
        // Only refresh token operations require the database
        _jwtService = new JwtService(options, null!);
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
            userId, accountId, role, email, displayName, CancellationToken.None);

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
            userId, accountId, role, email, displayName, CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().Contain(c => c.Type == "displayName" && c.Value == displayName);
    }

    [Fact]
    public async Task GenerateAccessToken_IncludesEmptyDisplayNameClaim_WhenNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var role = "Owner";
        var email = "test@example.com";
        string? displayName = null;

        // Act
        var (accessToken, _) = await _jwtService.GenerateAccessTokenAsync(
            userId, accountId, role, email, displayName, CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        // displayName should be empty string when null is passed
        token.Claims.Should().Contain(c => c.Type == "displayName" && c.Value == "");
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
            userId, accountId, role, email, displayName, CancellationToken.None);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(accessToken);

        token.Claims.Should().Contain(c => c.Type == "userId" && c.Value == userId.ToString());
        token.Claims.Should().Contain(c => c.Type == "accountId" && c.Value == accountId.ToString());
        token.Claims.Should().Contain(c => c.Type == "role" && c.Value == role);
        token.Claims.Should().Contain(c => c.Type == "email" && c.Value == email);
        token.Claims.Should().Contain(c => c.Type == "displayName" && c.Value == displayName);
    }
}
