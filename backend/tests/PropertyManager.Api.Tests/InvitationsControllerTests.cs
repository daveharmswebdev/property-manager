using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Persistence;

namespace PropertyManager.Api.Tests;

public class InvitationsControllerTests : IClassFixture<PropertyManagerWebApplicationFactory>
{
    private readonly PropertyManagerWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public InvitationsControllerTests(PropertyManagerWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // ==================== CREATE INVITATION TESTS ====================

    [Fact]
    public async Task CreateInvitation_WithoutAuth_Returns401()
    {
        // Arrange
        var request = new { Email = "newuser@example.com" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/invitations", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateInvitation_WithNonOwnerRole_Returns403()
    {
        // Arrange - Create a user with "Member" role
        var ownerEmail = $"member{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Member");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var request = new { Email = $"invitee{Guid.NewGuid():N}@example.com" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateInvitation_WithOwnerRole_Returns201AndSendsEmail()
    {
        // Arrange
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var request = new { Email = inviteeEmail };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<CreateInvitationResponse>();
        content.Should().NotBeNull();
        content!.InvitationId.Should().NotBe(Guid.Empty);
        content.Message.Should().Contain("success");

        // Verify invitation email was sent
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .FirstOrDefault(e => e.Email == inviteeEmail.ToLowerInvariant());
        sentInvitation.Should().NotBeNull("Invitation email should have been sent");
        sentInvitation.Code.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CreateInvitation_WithInvalidEmail_Returns400()
    {
        // Arrange
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var request = new { Email = "not-an-email" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateInvitation_WithEmptyEmail_Returns400()
    {
        // Arrange
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var request = new { Email = "" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateInvitation_WithAlreadyRegisteredEmail_Returns400()
    {
        // Arrange
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Try to invite an already registered user
        var existingUserEmail = $"existing{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(existingUserEmail, "Test@123456", "Owner");

        var request = new { Email = existingUserEmail };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("already registered");
    }

    [Fact]
    public async Task CreateInvitation_WithPendingInvitation_Returns400()
    {
        // Arrange
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";

        // Create first invitation
        var request = new { Email = inviteeEmail };
        var firstResponse = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act - Try to create a second invitation for the same email
        var secondResponse = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        secondResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await secondResponse.Content.ReadAsStringAsync();
        content.Should().Contain("pending invitation");
    }

    [Fact]
    public async Task CreateInvitation_NormalizesEmailToLowercase()
    {
        // Arrange
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var uniquePart = Guid.NewGuid().ToString("N");
        var mixedCaseEmail = $"InvitEE{uniquePart}@Example.COM";

        var request = new { Email = mixedCaseEmail };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Verify invitation was stored with lowercase email
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .FirstOrDefault(e => e.Email == mixedCaseEmail.ToLowerInvariant());
        sentInvitation.Should().NotBeNull();
    }

    // ==================== VALIDATE INVITATION TESTS ====================

    [Fact]
    public async Task ValidateInvitation_WithValidCode_ReturnsValidWithEmail()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);

        // Get the invitation code from fake email service
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        // Act - Validate without auth (anonymous endpoint)
        var response = await _client.GetAsync($"/api/v1/invitations/{code}/validate");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ValidateInvitationResponse>();
        content.Should().NotBeNull();
        content!.IsValid.Should().BeTrue();
        content.Email.Should().Be(inviteeEmail.ToLowerInvariant());
        content.ErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task ValidateInvitation_WithInvalidCode_ReturnsInvalidWithError()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/invitations/invalidcode123/validate");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ValidateInvitationResponse>();
        content.Should().NotBeNull();
        content!.IsValid.Should().BeFalse();
        content.Email.Should().BeNull();
        content.ErrorMessage.Should().Contain("Invalid");
    }

    [Fact]
    public async Task ValidateInvitation_WithExpiredCode_ReturnsInvalidWithError()
    {
        // Arrange - Create an expired invitation directly in database
        var inviteeEmail = $"expired{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitation = new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                ExpiresAt = DateTime.UtcNow.AddDays(-1) // Expired yesterday
            };
            dbContext.Invitations.Add(invitation);
            await dbContext.SaveChangesAsync();
        }

        // Act
        var response = await _client.GetAsync($"/api/v1/invitations/{rawCode}/validate");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ValidateInvitationResponse>();
        content.Should().NotBeNull();
        content!.IsValid.Should().BeFalse();
        content.ErrorMessage.Should().Contain("expired");
    }

    [Fact]
    public async Task ValidateInvitation_WithUsedCode_ReturnsInvalidWithError()
    {
        // Arrange - Create a used invitation directly in database
        var inviteeEmail = $"used{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitation = new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23), // Still valid
                UsedAt = DateTime.UtcNow.AddMinutes(-30) // But already used
            };
            dbContext.Invitations.Add(invitation);
            await dbContext.SaveChangesAsync();
        }

        // Act
        var response = await _client.GetAsync($"/api/v1/invitations/{rawCode}/validate");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var content = await response.Content.ReadFromJsonAsync<ValidateInvitationResponse>();
        content.Should().NotBeNull();
        content!.IsValid.Should().BeFalse();
        content.ErrorMessage.Should().Contain("already been used");
    }

    [Fact]
    public async Task ValidateInvitation_WithEmptyCode_Returns400()
    {
        // Act - Empty string in route would result in different route matching
        // Testing with whitespace-only code
        var response = await _client.GetAsync("/api/v1/invitations/%20/validate");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== ACCEPT INVITATION TESTS ====================

    [Fact]
    public async Task AcceptInvitation_WithValidCodeAndPassword_Returns201AndCreatesAccount()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);

        // Get the invitation code
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        var acceptRequest = new { Password = "NewUser@123456" };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var content = await response.Content.ReadFromJsonAsync<AcceptInvitationResponse>();
        content.Should().NotBeNull();
        content!.UserId.Should().NotBe(Guid.Empty);
        content.Email.Should().Be(inviteeEmail.ToLowerInvariant());
        content.Message.Should().Contain("success");
    }

    [Fact]
    public async Task AcceptInvitation_WithValidCodeAndPassword_UserCanLogin()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var password = "NewUser@123456";
        var createRequest = new { Email = inviteeEmail };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);

        // Get the invitation code
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        // Accept the invitation
        var acceptRequest = new { Password = password };
        var acceptResponse = await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act - Try to login with the new account
        var loginRequest = new { Email = inviteeEmail, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AcceptInvitation_WithInvalidCode_Returns400()
    {
        // Arrange
        var acceptRequest = new { Password = "NewUser@123456" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/invitations/invalidcode123/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Invalid");
    }

    [Fact]
    public async Task AcceptInvitation_WithExpiredCode_Returns400()
    {
        // Arrange - Create an expired invitation directly in database
        var inviteeEmail = $"expired{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitation = new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                ExpiresAt = DateTime.UtcNow.AddDays(-1) // Expired yesterday
            };
            dbContext.Invitations.Add(invitation);
            await dbContext.SaveChangesAsync();
        }

        var acceptRequest = new { Password = "NewUser@123456" };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{rawCode}/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("expired");
    }

    [Fact]
    public async Task AcceptInvitation_WithUsedCode_Returns400()
    {
        // Arrange - Create a used invitation directly in database
        var inviteeEmail = $"used{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitation = new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23), // Still valid time-wise
                UsedAt = DateTime.UtcNow.AddMinutes(-30) // But already used
            };
            dbContext.Invitations.Add(invitation);
            await dbContext.SaveChangesAsync();
        }

        var acceptRequest = new { Password = "NewUser@123456" };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{rawCode}/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("already been used");
    }

    [Fact]
    public async Task AcceptInvitation_WithWeakPassword_Returns400()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);

        // Get the invitation code
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        var acceptRequest = new { Password = "weak" }; // Too short, no requirements

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Password");
    }

    [Fact]
    public async Task AcceptInvitation_WithEmptyPassword_Returns400()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);

        // Get the invitation code
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        var acceptRequest = new { Password = "" };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AcceptInvitation_MarksInvitationAsUsed()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateInvitationResponse>();
        var invitationId = createContent!.InvitationId;

        // Get the invitation code
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        // Accept the invitation
        var acceptRequest = new { Password = "NewUser@123456" };
        await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Act - Try to use the same code again
        var secondAcceptResponse = await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Assert
        secondAcceptResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await secondAcceptResponse.Content.ReadAsStringAsync();
        content.Should().Contain("already been used");

        // Also verify in database
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var invitation = await dbContext.Invitations.FindAsync(invitationId);
        invitation.Should().NotBeNull();
        invitation!.UsedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task AcceptInvitation_CreatesUserWithOwnerRole()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var password = "NewUser@123456";
        var createRequest = new { Email = inviteeEmail };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);

        // Get the invitation code
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var code = sentInvitation.Code;

        // Accept the invitation
        var acceptRequest = new { Password = password };
        await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Act - Login and check JWT claims
        var loginRequest = new { Email = inviteeEmail, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();

        // Decode JWT and verify role
        var payload = DecodeJwtPayload(loginContent!.AccessToken);

        // Assert
        payload["role"]!.ToString().Should().Be("Owner");
    }

    // ==================== HELPER METHODS ====================

    private async Task<string> GetAccessTokenAsync(string email, string password)
    {
        var loginRequest = new { Email = email, Password = password };
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<LoginResponse>();
        return content!.AccessToken;
    }

    private async Task<HttpResponseMessage> PostAsJsonWithAuthAsync<T>(string url, T content, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        request.Content = JsonContent.Create(content);
        return await _client.SendAsync(request);
    }

    private static string GenerateSecureCode()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static string ComputeHash(string code)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToBase64String(hashBytes);
    }

    private static Dictionary<string, object?> DecodeJwtPayload(string jwt)
    {
        var parts = jwt.Split('.');
        var payload = parts[1];
        var paddedPayload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
        var bytes = Convert.FromBase64String(paddedPayload);
        var json = System.Text.Encoding.UTF8.GetString(bytes);
        return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(json)!;
    }

    // DTOs for deserialization
    private record CreateInvitationResponse(Guid InvitationId, string Message);
    private record ValidateInvitationResponse(bool IsValid, string? Email, string? ErrorMessage);
    private record AcceptInvitationResponse(Guid UserId, string Email, string Message);
    private record LoginResponse(string AccessToken, int ExpiresIn);
}
