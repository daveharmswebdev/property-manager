using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Domain.Authorization;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Infrastructure.Identity;

/// <summary>
/// Implementation of IJwtService for JWT token generation and refresh token management.
/// </summary>
public class JwtService : IJwtService
{
    private readonly JwtSettings _settings;
    private readonly AppDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;

    public JwtService(
        IOptions<JwtSettings> settings,
        AppDbContext dbContext,
        UserManager<ApplicationUser> userManager)
    {
        _settings = settings.Value;
        _dbContext = dbContext;
        _userManager = userManager;
    }

    public Task<(string AccessToken, int ExpiresIn)> GenerateAccessTokenAsync(
        Guid userId,
        Guid accountId,
        string role,
        string email,
        string? displayName,
        Guid? propertyId = null,
        bool isPlatformAdmin = false,
        CancellationToken cancellationToken = default)
    {
        var expiresIn = _settings.AccessTokenExpiryMinutes * 60; // Convert to seconds
        var expires = DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpiryMinutes);

        // Create claims per AC4.2
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new("userId", userId.ToString()),
            new("accountId", accountId.ToString()),
            new(ClaimTypes.Role, role),
            new("role", role),
            new("email", email)
        };

        if (!string.IsNullOrEmpty(displayName))
        {
            claims.Add(new("displayName", displayName));
        }

        if (propertyId.HasValue)
        {
            claims.Add(new("propertyId", propertyId.Value.ToString()));
        }

        // Story 22.1 — emit the platformAdmin claim only when true. Omit otherwise to keep
        // the token minimal for the 99% non-admin case.
        if (isPlatformAdmin)
        {
            claims.Add(new(PlatformClaims.PlatformAdmin, "true"));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return Task.FromResult((tokenString, expiresIn));
    }

    public async Task<string> GenerateRefreshTokenAsync(
        Guid userId,
        Guid accountId,
        CancellationToken cancellationToken = default)
    {
        // Generate cryptographically secure random token
        var randomBytes = new byte[64];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(randomBytes);
        }
        var refreshToken = Convert.ToBase64String(randomBytes);

        // Hash the token for secure storage
        var tokenHash = HashToken(refreshToken);

        // Create RefreshToken entity
        var refreshTokenEntity = new RefreshToken
        {
            UserId = userId,
            AccountId = accountId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenExpiryDays),
            DeviceInfo = null // Can be populated from request headers if needed
        };

        _dbContext.RefreshTokens.Add(refreshTokenEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return refreshToken;
    }

    public async Task<(bool IsValid, Guid? UserId, Guid? AccountId, string? Role, string? Email, string? DisplayName, Guid? PropertyId, bool IsPlatformAdmin)> ValidateRefreshTokenAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = HashToken(refreshToken);

        // Find the refresh token in database (ignore query filters for this lookup)
        var storedToken = await _dbContext.RefreshTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (storedToken == null || !storedToken.IsValid)
        {
            return (false, null, null, null, null, null, null, false);
        }

        // Get user info
        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == storedToken.UserId, cancellationToken);

        if (user == null)
        {
            return (false, null, null, null, null, null, null, false);
        }

        // Story 22.1 — read the platformAdmin claim so it can be re-issued in the new JWT.
        var userClaims = await _userManager.GetClaimsAsync(user);
        var isPlatformAdmin = userClaims.Any(c =>
            c.Type == PlatformClaims.PlatformAdmin &&
            string.Equals(c.Value, "true", StringComparison.Ordinal));

        return (true, storedToken.UserId, storedToken.AccountId, user.Role, user.Email, user.DisplayName, user.PropertyId, isPlatformAdmin);
    }

    public async Task RevokeRefreshTokenAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = HashToken(refreshToken);

        var storedToken = await _dbContext.RefreshTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (storedToken != null)
        {
            storedToken.RevokedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task RevokeAllUserRefreshTokensAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var tokens = await _dbContext.RefreshTokens
            .IgnoreQueryFilters()
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        foreach (var token in tokens)
        {
            token.RevokedAt = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Hash the refresh token using SHA256 for secure storage.
    /// </summary>
    private static string HashToken(string token)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }
}
