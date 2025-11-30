using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Infrastructure.Identity;

namespace PropertyManager.Api.Tests;

public class AuthControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuthControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_WithValidData_Returns201()
    {
        // Arrange
        var request = new
        {
            Email = $"test{Guid.NewGuid():N}@example.com",
            Password = "Test@123456",
            Name = "Test Account"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<RegisterResponse>();
        content.Should().NotBeNull();
        content!.UserId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Register_WithWeakPassword_Returns400WithValidationErrors()
    {
        // Arrange
        var request = new
        {
            Email = $"test{Guid.NewGuid():N}@example.com",
            Password = "weak", // Too short, no uppercase, no number, no special char
            Name = "Test Account"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Password");
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns400()
    {
        // Arrange
        var email = $"duplicate{Guid.NewGuid():N}@example.com";
        var request1 = new
        {
            Email = email,
            Password = "Test@123456",
            Name = "Test Account 1"
        };
        var request2 = new
        {
            Email = email,
            Password = "Test@123456",
            Name = "Test Account 2"
        };

        // First registration should succeed
        var response1 = await _client.PostAsJsonAsync("/api/v1/auth/register", request1);
        response1.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act - second registration with same email
        var response2 = await _client.PostAsJsonAsync("/api/v1/auth/register", request2);

        // Assert
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var content = await response2.Content.ReadAsStringAsync();
        content.Should().Contain("email");
    }

    [Fact]
    public async Task VerifyEmail_WithValidToken_Returns204()
    {
        // Arrange - Register a user first
        var email = $"verify{Guid.NewGuid():N}@example.com";
        var registerRequest = new
        {
            Email = email,
            Password = "Test@123456",
            Name = "Test Account"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var registerContent = await registerResponse.Content.ReadFromJsonAsync<RegisterResponse>();
        var userId = registerContent!.UserId;

        // Get the verification token from the fake email service (singleton)
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentEmail = fakeEmailService.SentVerificationEmails.FirstOrDefault(e => e.Email == email);
        sentEmail.Should().NotBeNull($"Verification email should have been sent to {email}");

        var token = sentEmail!.Token;

        // Act
        var verifyRequest = new { Token = token };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", verifyRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify user is now confirmed
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var verifiedUser = await userManager.FindByIdAsync(userId);
        verifiedUser!.EmailConfirmed.Should().BeTrue();
    }

    [Fact]
    public async Task VerifyEmail_WithInvalidToken_Returns400()
    {
        // Arrange
        var invalidToken = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{Guid.NewGuid()}:invalidtoken"));

        var request = new { Token = invalidToken };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task VerifyEmail_WithMalformedToken_Returns400()
    {
        // Arrange
        var request = new { Token = "not-a-valid-base64-token!" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task VerifyEmail_WithAlreadyVerifiedToken_Returns400()
    {
        // Arrange - Register and verify a user
        var email = $"alreadyverified{Guid.NewGuid():N}@example.com";
        var registerRequest = new
        {
            Email = email,
            Password = "Test@123456",
            Name = "Test Account"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Get the verification token from the fake email service (singleton)
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentEmail = fakeEmailService.SentVerificationEmails.FirstOrDefault(e => e.Email == email);
        sentEmail.Should().NotBeNull();

        var token = sentEmail!.Token;

        // First verification
        var verifyRequest = new { Token = token };
        var firstResponse = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", verifyRequest);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Act - Try to verify again with same token
        var secondResponse = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", verifyRequest);

        // Assert
        secondResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== LOGIN TESTS (AC4.1, AC4.3, AC4.4) ====================

    [Fact]
    public async Task Login_WithValidCredentials_Returns200WithJwtToken()
    {
        // Arrange - Create and verify a user
        var email = $"login{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await CreateAndVerifyUser(email, password);

        var loginRequest = new { Email = email, Password = password };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert (AC4.1)
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<LoginResponse>();
        content.Should().NotBeNull();
        content!.AccessToken.Should().NotBeNullOrEmpty();
        content.ExpiresIn.Should().Be(3600); // 60 minutes in seconds

        // Verify refresh token cookie was set
        response.Headers.Should().ContainKey("Set-Cookie");
        var setCookieHeader = response.Headers.GetValues("Set-Cookie").FirstOrDefault();
        setCookieHeader.Should().Contain("refreshToken=");
        setCookieHeader!.ToLower().Should().Contain("httponly");
        setCookieHeader.ToLower().Should().Contain("secure");
    }

    [Fact]
    public async Task Login_WithInvalidPassword_Returns401WithGenericMessage()
    {
        // Arrange - Create and verify a user
        var email = $"loginwrongpwd{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await CreateAndVerifyUser(email, password);

        var loginRequest = new { Email = email, Password = "WrongPassword@123" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert (AC4.3 - generic error message)
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Invalid email or password");
        // Should NOT reveal whether email exists
        content.ToLower().Should().NotContain("user not found");
    }

    [Fact]
    public async Task Login_WithNonexistentEmail_Returns401WithGenericMessage()
    {
        // Arrange
        var loginRequest = new
        {
            Email = $"nonexistent{Guid.NewGuid():N}@example.com",
            Password = "Test@123456"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert (AC4.3 - generic error message, no user enumeration)
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Invalid email or password");
    }

    [Fact]
    public async Task Login_WithUnverifiedEmail_Returns401WithSpecificMessage()
    {
        // Arrange - Create user but DON'T verify
        var email = $"unverified{Guid.NewGuid():N}@example.com";
        var registerRequest = new
        {
            Email = email,
            Password = "Test@123456",
            Name = "Test Account"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var loginRequest = new { Email = email, Password = "Test@123456" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert (AC4.4)
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var content = await response.Content.ReadAsStringAsync();
        content.ToLower().Should().Contain("verify your email");
    }

    [Fact]
    public async Task Login_WithMissingEmail_Returns400()
    {
        // Arrange
        var loginRequest = new { Password = "Test@123456" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_WithMissingPassword_Returns400()
    {
        // Arrange
        var loginRequest = new { Email = "test@example.com" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== JWT TOKEN TESTS (AC4.2) ====================

    [Fact]
    public async Task Login_JwtContainsRequiredClaims()
    {
        // Arrange
        var email = $"jwtclaims{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await CreateAndVerifyUser(email, password);

        var loginRequest = new { Email = email, Password = password };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        var content = await response.Content.ReadFromJsonAsync<LoginResponse>();

        // Assert - decode JWT and verify claims (AC4.2)
        var jwt = content!.AccessToken;
        var payload = DecodeJwtPayload(jwt);

        payload.Should().ContainKey("userId");
        payload.Should().ContainKey("accountId");
        payload.Should().ContainKey("role");
        payload.Should().ContainKey("exp");

        // Verify values are valid GUIDs
        Guid.TryParse(payload["userId"].ToString(), out var userId).Should().BeTrue();
        Guid.TryParse(payload["accountId"].ToString(), out var accountId).Should().BeTrue();
        payload["role"].ToString().Should().Be("Owner");

        // Verify expiration is ~60 minutes from now
        var exp = long.Parse(payload["exp"].ToString()!);
        var expDateTime = DateTimeOffset.FromUnixTimeSeconds(exp);
        var expectedExp = DateTimeOffset.UtcNow.AddMinutes(60);
        expDateTime.Should().BeCloseTo(expectedExp, TimeSpan.FromMinutes(1));
    }

    // ==================== REFRESH TOKEN TESTS (AC4.6) ====================

    [Fact]
    public async Task Refresh_WithValidRefreshToken_Returns200WithNewAccessToken()
    {
        // Arrange - Login first
        var email = $"refresh{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await CreateAndVerifyUser(email, password);

        var loginRequest = new { Email = email, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Extract cookies from login response
        var cookies = loginResponse.Headers.GetValues("Set-Cookie");

        // Create request with refresh token cookie
        var refreshRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        foreach (var cookie in cookies)
        {
            refreshRequest.Headers.Add("Cookie", cookie.Split(';')[0]);
        }

        // Act
        var refreshResponse = await _client.SendAsync(refreshRequest);

        // Assert (AC4.6)
        refreshResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await refreshResponse.Content.ReadFromJsonAsync<RefreshResponse>();
        content.Should().NotBeNull();
        content!.AccessToken.Should().NotBeNullOrEmpty();
        content.ExpiresIn.Should().Be(3600);
    }

    [Fact]
    public async Task Refresh_WithoutRefreshToken_Returns401()
    {
        // Act - Call refresh without any cookie
        var response = await _client.PostAsync("/api/v1/auth/refresh", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("No refresh token");
    }

    [Fact]
    public async Task Refresh_WithInvalidRefreshToken_Returns401()
    {
        // Arrange
        var refreshRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshRequest.Headers.Add("Cookie", "refreshToken=invalidtoken");

        // Act
        var response = await _client.SendAsync(refreshRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==================== CONCURRENT SESSIONS TEST (AC4.7) ====================

    [Fact]
    public async Task Login_MultipleTimes_CreatesSeparateSessions()
    {
        // Arrange - Create and verify a user
        var email = $"concurrent{Guid.NewGuid():N}@example.com";
        var password = "Test@123456";

        await CreateAndVerifyUser(email, password);

        var loginRequest = new { Email = email, Password = password };

        // Act - Login twice (simulating different devices/browsers)
        var response1 = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        var response2 = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert (AC4.7 - multiple concurrent sessions allowed)
        response1.StatusCode.Should().Be(HttpStatusCode.OK);
        response2.StatusCode.Should().Be(HttpStatusCode.OK);

        var token1 = (await response1.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken;
        var token2 = (await response2.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken;

        // Tokens should be different (different JTI)
        token1.Should().NotBe(token2);

        // Both tokens should be valid for the same user
        var payload1 = DecodeJwtPayload(token1);
        var payload2 = DecodeJwtPayload(token2);

        payload1["userId"].ToString().Should().Be(payload2["userId"].ToString());
        payload1["jti"].ToString().Should().NotBe(payload2["jti"].ToString());
    }

    // ==================== HELPER METHODS ====================

    private async Task CreateAndVerifyUser(string email, string password)
    {
        // Register
        var registerRequest = new
        {
            Email = email,
            Password = password,
            Name = "Test Account"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/v1/auth/register", registerRequest);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Get verification token
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentEmail = fakeEmailService.SentVerificationEmails.FirstOrDefault(e => e.Email == email);
        sentEmail.Should().NotBeNull();

        // Verify email
        var verifyRequest = new { Token = sentEmail!.Token };
        var verifyResponse = await _client.PostAsJsonAsync("/api/v1/auth/verify-email", verifyRequest);
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    private Dictionary<string, object?> DecodeJwtPayload(string jwt)
    {
        var parts = jwt.Split('.');
        parts.Length.Should().Be(3);

        var payload = parts[1];
        // Add padding if needed
        var paddedPayload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
        var bytes = Convert.FromBase64String(paddedPayload);
        var json = System.Text.Encoding.UTF8.GetString(bytes);

        return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(json)!;
    }

    private record RegisterResponse(string UserId);
    private record LoginResponse(string AccessToken, int ExpiresIn);
    private record RefreshResponse(string AccessToken, int ExpiresIn);
}
