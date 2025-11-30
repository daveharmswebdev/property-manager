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

    private record RegisterResponse(string UserId);
}
