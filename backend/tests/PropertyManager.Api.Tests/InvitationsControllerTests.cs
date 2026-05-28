using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PropertyManager.Domain.Authorization;
using PropertyManager.Domain.Entities;
using PropertyManager.Infrastructure.Identity;
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
        var request = new { Email = "newuser@example.com", Role = "Owner" };

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

        var request = new { Email = $"invitee{Guid.NewGuid():N}@example.com", Role = "Owner" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateInvitation_WithOwnerRole_Returns201AndSendsEmail()
    {
        // Arrange — AC: #1 — includes Role in request
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var request = new { Email = inviteeEmail, Role = "Owner" };

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

        var request = new { Email = "not-an-email", Role = "Owner" };

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

        var request = new { Email = "", Role = "Owner" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateInvitation_WithInvalidRole_Returns400()
    {
        // Arrange — AC: validates role is Owner or Contributor
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var request = new { Email = $"invitee{Guid.NewGuid():N}@example.com", Role = "Admin" };

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

        var request = new { Email = existingUserEmail, Role = "Owner" };

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
        var request = new { Email = inviteeEmail, Role = "Owner" };
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

        var request = new { Email = mixedCaseEmail, Role = "Owner" };

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

    [Fact]
    public async Task CreateInvitation_StoresAccountIdAndInvitedByUserId()
    {
        // Arrange — AC: #1 — invitation stores inviter's AccountId and UserId
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (ownerUserId, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var request = new { Email = inviteeEmail, Role = "Contributor" };

        // Act
        var response = await PostAsJsonWithAuthAsync("/api/v1/invitations", request, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var responseContent = await response.Content.ReadFromJsonAsync<CreateInvitationResponse>();

        // Verify invitation in database has correct AccountId and InvitedByUserId
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var invitation = await dbContext.Invitations.FindAsync(responseContent!.InvitationId);
        invitation.Should().NotBeNull();
        invitation!.AccountId.Should().Be(ownerAccountId);
        invitation.InvitedByUserId.Should().Be(ownerUserId);
        invitation.Role.Should().Be("Contributor");
    }

    // ==================== VALIDATE INVITATION TESTS ====================

    [Fact]
    public async Task ValidateInvitation_WithValidCode_ReturnsValidWithEmailAndRole()
    {
        // Arrange - Create an invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail, Role = "Contributor" };
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
        content.Role.Should().Be("Contributor");
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
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
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
        content.Message.Should().Contain("joined account");
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
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
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
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
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
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
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
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
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
    public async Task AcceptInvitation_JoinsInviterAccount_WithOwnerRole()
    {
        // Arrange — AC: #2, #4 — user joins inviter's account with Owner role
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var password = "NewUser@123456";
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
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

        // Decode JWT and verify role and accountId
        var payload = DecodeJwtPayload(loginContent!.AccessToken);

        // Assert
        payload["role"]!.ToString().Should().Be("Owner");
        payload["accountId"]!.ToString().Should().Be(ownerAccountId.ToString());
    }

    [Fact]
    public async Task AcceptInvitation_WithContributorRole_CreatesUserWithContributorRole()
    {
        // Arrange — AC: #3 — Contributor role is passed through
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var password = "NewUser@123456";
        var createRequest = new { Email = inviteeEmail, Role = "Contributor" };
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
        payload["role"]!.ToString().Should().Be("Contributor");
        payload["accountId"]!.ToString().Should().Be(ownerAccountId.ToString());
    }

    [Fact]
    public async Task AcceptInvitation_JoinsInviterAccount_SeesSharedData()
    {
        // Arrange — AC: #2 — invitee sees same properties as inviter
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var ownerToken = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Create a property as owner
        var propertyRequest = new
        {
            Name = $"Shared Property {Guid.NewGuid():N}",
            Street = "123 Shared St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
        var propertyResponse = await PostAsJsonWithAuthAsync("/api/v1/properties", propertyRequest, ownerToken);
        propertyResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Create invitation for invitee
        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var password = "NewUser@123456";
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
        await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, ownerToken);

        // Accept the invitation
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sentInvitation = fakeEmailService.SentInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        var acceptRequest = new { Password = password };
        await _client.PostAsJsonAsync($"/api/v1/invitations/{sentInvitation.Code}/accept", acceptRequest);

        // Act — Login as invitee and list properties
        var inviteeToken = await GetAccessTokenAsync(inviteeEmail, password);
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/properties");
        request.Headers.Add("Authorization", $"Bearer {inviteeToken}");
        var propertiesResponse = await _client.SendAsync(request);

        // Assert
        propertiesResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var propertiesContent = await propertiesResponse.Content.ReadAsStringAsync();
        propertiesContent.Should().Contain("Shared Property");
    }

    [Fact]
    public async Task AcceptInvitation_WithoutAccountId_CreatesNewAccount()
    {
        // Arrange — AC: #5 — legacy path creates new account + Owner role
        var inviteeEmail = $"legacy{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // Create invitation without AccountId (legacy path)
            var invitation = new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                AccountId = null,
                InvitedByUserId = null,
                Role = "Owner"
            };
            dbContext.Invitations.Add(invitation);
            await dbContext.SaveChangesAsync();
        }

        var password = "NewUser@123456";
        var acceptRequest = new { Password = password };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{rawCode}/accept", acceptRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var content = await response.Content.ReadFromJsonAsync<AcceptInvitationResponse>();
        content.Should().NotBeNull();
        content!.Message.Should().Contain("Account created");

        // Verify user can login with Owner role
        var loginRequest = new { Email = inviteeEmail, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        var payload = DecodeJwtPayload(loginContent!.AccessToken);
        payload["role"]!.ToString().Should().Be("Owner");
    }

    // ==================== LANDLORD ACCEPT (Story 22.3) ====================
    //
    // These tests prove the two halves of the landlord-onboarding flow connect:
    // the create-side (POST /api/v1/admin/landlord-invitations — Story 22.2, produces an
    // AccountId == null invitation) and the accept-side (POST /api/v1/invitations/{code}/accept
    // — provisions a brand-new top-level account). They exercise the full HTTP + real
    // PostgreSQL + EF Core global-query-filter pipeline, which unit mocks cannot.

    [Fact]
    public async Task Accept_LandlordInvitation_Returns201_CreatesNewTopLevelAccount()
    {
        // Arrange — AC-22.3.1 — full create→accept flow.
        // Create a PlatformAdmin (who is also Owner of their own account) and issue a
        // landlord invitation through the real admin endpoint so AccountId == null.
        var (adminUserId, adminAccountId, adminToken) = await CreatePlatformAdminAsync();

        var inviteeEmail = $"landlord{Guid.NewGuid():N}@example.com";
        var createResponse = await PostAsJsonWithAuthAsync(
            "/api/v1/admin/landlord-invitations", new { Email = inviteeEmail }, adminToken);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var code = GetLandlordInvitationCode(inviteeEmail);

        // Act
        var acceptRequest = new { Password = "NewLandlord@123456" };
        var response = await _client.PostAsJsonAsync($"/api/v1/invitations/{code}/accept", acceptRequest);

        // Assert — response body shape
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var content = await response.Content.ReadFromJsonAsync<AcceptInvitationResponse>();
        content.Should().NotBeNull();
        content!.UserId.Should().NotBe(Guid.Empty);
        content.Message.Should().Contain("Account created");

        // Assert — DB post-conditions
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var newUser = await userManager.FindByEmailAsync(inviteeEmail);
        newUser.Should().NotBeNull("the accepted invitation should have created a user");
        newUser!.Id.Should().Be(content.UserId);
        newUser.Role.Should().Be("Owner");
        newUser.EmailConfirmed.Should().BeTrue();
        newUser.Email.Should().Be(inviteeEmail);

        // The new account exists, is distinct from the inviter's, and is owned by the new user.
        newUser.AccountId.Should().NotBe(adminAccountId, "the landlord must get their OWN account");
        var newAccount = await dbContext.Accounts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == newUser.AccountId);
        newAccount.Should().NotBeNull();
        newAccount!.CreatedByUserId.Should().Be(content.UserId);

        // The invitation was consumed.
        var invitation = await dbContext.Invitations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Email == inviteeEmail.ToLowerInvariant());
        invitation.Should().NotBeNull();
        invitation!.UsedAt.Should().NotBeNull();
        invitation.AccountId.Should().BeNull("a landlord invitation is created with a null AccountId");

        // Sanity: the inviter is untouched.
        adminUserId.Should().NotBe(content.UserId);
    }

    [Fact]
    public async Task Accept_LandlordInvitation_NewOwnerSeesZeroInheritedData()
    {
        // Arrange — AC-22.3.2 — the inviter's account already owns a property (and a vendor).
        var (_, adminAccountId, adminToken) = await CreatePlatformAdminAsync();
        await _factory.CreatePropertyInAccountAsync(adminAccountId, name: $"Inviter Property {Guid.NewGuid():N}");

        // Seed a vendor in the inviter's account via the API so it carries the right AccountId.
        var vendorRequest = new { FirstName = "Inviter", LastName = $"Vendor{Guid.NewGuid():N}" };
        var vendorResponse = await PostAsJsonWithAuthAsync("/api/v1/vendors", vendorRequest, adminToken);
        vendorResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var inviteeEmail = $"landlord{Guid.NewGuid():N}@example.com";
        await PostAsJsonWithAuthAsync(
            "/api/v1/admin/landlord-invitations", new { Email = inviteeEmail }, adminToken);
        var code = GetLandlordInvitationCode(inviteeEmail);

        var password = "NewLandlord@123456";
        var acceptResponse = await _client.PostAsJsonAsync(
            $"/api/v1/invitations/{code}/accept", new { Password = password });
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act — log in as the new landlord and query their own data.
        var landlordToken = await GetAccessTokenAsync(inviteeEmail, password);
        var propertiesResponse = await GetWithAuthAsync("/api/v1/properties", landlordToken);
        var vendorsResponse = await GetWithAuthAsync("/api/v1/vendors", landlordToken);

        // Assert — both lists are empty for the brand-new account (tenant isolation).
        propertiesResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var properties = await propertiesResponse.Content.ReadFromJsonAsync<ListEnvelope>();
        properties.Should().NotBeNull();
        properties!.TotalCount.Should().Be(0);
        properties.Items.Should().BeEmpty();

        vendorsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var vendors = await vendorsResponse.Content.ReadFromJsonAsync<ListEnvelope>();
        vendors.Should().NotBeNull();
        vendors!.TotalCount.Should().Be(0);
        vendors.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Accept_LandlordInvitation_JwtCarriesNewAccountId_NotInviters()
    {
        // Arrange — AC-22.3.6 — JWT must carry the NEW account id, role Owner, no platformAdmin.
        var (_, adminAccountId, adminToken) = await CreatePlatformAdminAsync();

        var inviteeEmail = $"landlord{Guid.NewGuid():N}@example.com";
        await PostAsJsonWithAuthAsync(
            "/api/v1/admin/landlord-invitations", new { Email = inviteeEmail }, adminToken);
        var code = GetLandlordInvitationCode(inviteeEmail);

        var password = "NewLandlord@123456";
        var acceptResponse = await _client.PostAsJsonAsync(
            $"/api/v1/invitations/{code}/accept", new { Password = password });
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Resolve the new account id from the DB.
        Guid newAccountId;
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var newUser = await userManager.FindByEmailAsync(inviteeEmail);
            newUser.Should().NotBeNull();
            newAccountId = newUser!.AccountId;
        }

        // Act — log in as the new landlord and decode the JWT.
        var loginRequest = new { Email = inviteeEmail, Password = password };
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginContent = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        var payload = DecodeJwtPayload(loginContent!.AccessToken);

        // Assert
        payload["accountId"]!.ToString().Should().Be(newAccountId.ToString());
        payload["accountId"]!.ToString().Should().NotBe(adminAccountId.ToString(),
            "the new landlord's token must not carry the inviting PlatformAdmin's account id");
        payload["role"]!.ToString().Should().Be("Owner");
        payload.Should().NotContainKey("platformAdmin",
            "the new landlord is an account Owner, not a platform admin");
    }

    [Fact]
    public async Task Accept_LandlordInvitation_DoesNotContaminateInviterData()
    {
        // Arrange — AC-22.3.7 — provisioning a new landlord must not change the inviter's view.
        var (_, adminAccountId, adminToken) = await CreatePlatformAdminAsync();
        await _factory.CreatePropertyInAccountAsync(adminAccountId, name: $"Inviter Property {Guid.NewGuid():N}");

        // Capture the inviter's property count BEFORE acceptance (delta-based, pollution-robust).
        var beforeResponse = await GetWithAuthAsync("/api/v1/properties", adminToken);
        beforeResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var before = await beforeResponse.Content.ReadFromJsonAsync<ListEnvelope>();
        var beforeCount = before!.TotalCount;
        beforeCount.Should().BeGreaterThan(0, "the inviter seeded at least one property");

        var inviteeEmail = $"landlord{Guid.NewGuid():N}@example.com";
        await PostAsJsonWithAuthAsync(
            "/api/v1/admin/landlord-invitations", new { Email = inviteeEmail }, adminToken);
        var code = GetLandlordInvitationCode(inviteeEmail);

        var acceptResponse = await _client.PostAsJsonAsync(
            $"/api/v1/invitations/{code}/accept", new { Password = "NewLandlord@123456" });
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act — re-query as the inviter AFTER the new landlord account exists.
        var afterResponse = await GetWithAuthAsync("/api/v1/properties", adminToken);

        // Assert — the inviter's view is unchanged.
        afterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var after = await afterResponse.Content.ReadFromJsonAsync<ListEnvelope>();
        after!.TotalCount.Should().Be(beforeCount,
            "provisioning a new landlord account must not alter the inviter's data");
    }

    [Fact]
    public async Task Accept_LandlordInvitation_WeakPassword_RollsBackOrphanAccount()
    {
        // Arrange — AC-22.3.3 — a too-weak password fails the Identity policy AFTER the new
        // account row is created, so the handler must roll that account back.
        var inviteeEmail = $"landlord{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.Invitations.Add(new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                AccountId = null,
                InvitedByUserId = null,
                Role = "Owner"
            });
            await dbContext.SaveChangesAsync();
        }

        // Capture the total account count before the failing attempt.
        int accountCountBefore;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            accountCountBefore = await dbContext.Accounts.IgnoreQueryFilters().CountAsync();
        }

        // Act — accept with a password that fails the Identity policy.
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/invitations/{rawCode}/accept", new { Password = "weak" });

        // Assert — 400 with a Password error in the body (not just a status code).
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Password");

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            // No orphan account row remains.
            var accountCountAfter = await dbContext.Accounts.IgnoreQueryFilters().CountAsync();
            accountCountAfter.Should().Be(accountCountBefore, "the orphan account must be rolled back");

            // No user exists for the invitation email (Identity failure persisted nothing).
            var orphanUser = await dbContext.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.NormalizedEmail == inviteeEmail.ToUpperInvariant());
            orphanUser.Should().BeNull("a failed acceptance must not leave a user behind");

            // The invitation is still unused so the code can be retried.
            var invitation = await dbContext.Invitations.IgnoreQueryFilters()
                .FirstOrDefaultAsync(i => i.CodeHash == codeHash);
            invitation.Should().NotBeNull();
            invitation!.UsedAt.Should().BeNull("a failed acceptance must not consume the code");
        }
    }

    [Fact]
    public async Task Accept_TenantInvitation_JoinsExistingAccount_NoNewAccount()
    {
        // Arrange — AC-22.3.4 — a tenant invitation must NOT create a new account; the tenant
        // joins the inviter's existing account with Role=Tenant and the correct PropertyId.
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var propertyId = await _factory.CreatePropertyInAccountAsync(ownerAccountId);

        var inviteeEmail = $"tenant{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.Invitations.Add(new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                AccountId = ownerAccountId,
                PropertyId = propertyId,
                Role = "Tenant"
            });
            await dbContext.SaveChangesAsync();
        }

        int accountCountBefore;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            accountCountBefore = await dbContext.Accounts.IgnoreQueryFilters().CountAsync();
        }

        // Act
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/invitations/{rawCode}/accept", new { Password = "NewTenant@123456" });

        // Assert — response shape
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var content = await response.Content.ReadFromJsonAsync<AcceptInvitationResponse>();
        content!.Message.Should().Contain("joined account");

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            // The negative invariant this story owns: NO new account was created.
            var accountCountAfter = await dbContext.Accounts.IgnoreQueryFilters().CountAsync();
            accountCountAfter.Should().Be(accountCountBefore, "a tenant invitation must not create a new account");

            var newUser = await userManager.FindByEmailAsync(inviteeEmail);
            newUser.Should().NotBeNull();
            newUser!.AccountId.Should().Be(ownerAccountId);
            newUser.Role.Should().Be("Tenant");
            newUser.PropertyId.Should().Be(propertyId);
        }
    }

    [Fact]
    public async Task Accept_CoOwnerInvitation_JoinsExistingAccount_NoNewAccount()
    {
        // Arrange — AC-22.3.5 — a co-owner (Contributor) invitation must NOT create a new
        // account; the user joins the inviter's existing account with the invited role.
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");

        var inviteeEmail = $"coowner{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.Invitations.Add(new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24),
                AccountId = ownerAccountId,
                PropertyId = null,
                Role = "Contributor"
            });
            await dbContext.SaveChangesAsync();
        }

        int accountCountBefore;
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            accountCountBefore = await dbContext.Accounts.IgnoreQueryFilters().CountAsync();
        }

        // Act
        var response = await _client.PostAsJsonAsync(
            $"/api/v1/invitations/{rawCode}/accept", new { Password = "NewCoOwner@123456" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var content = await response.Content.ReadFromJsonAsync<AcceptInvitationResponse>();
        content!.Message.Should().Contain("joined account");

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            var accountCountAfter = await dbContext.Accounts.IgnoreQueryFilters().CountAsync();
            accountCountAfter.Should().Be(accountCountBefore, "a co-owner invitation must not create a new account");

            var newUser = await userManager.FindByEmailAsync(inviteeEmail);
            newUser.Should().NotBeNull();
            newUser!.AccountId.Should().Be(ownerAccountId);
            newUser.Role.Should().Be("Contributor");
        }
    }

    // ==================== GET ACCOUNT INVITATIONS TESTS ====================

    [Fact]
    public async Task GetAccountInvitations_AsOwner_ReturnsInvitationList()
    {
        // Arrange — AC: #3 — Owner sees invitations for their account
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Create an invitation
        var inviteeEmail = $"invitee{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail, Role = "Contributor" };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/invitations");
        request.Headers.Add("Authorization", $"Bearer {token}");
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<GetAccountInvitationsResponse>();
        content.Should().NotBeNull();
        content!.Items.Should().NotBeEmpty();
        content.Items.Should().Contain(i => i.Email == inviteeEmail.ToLowerInvariant());
        content.TotalCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetAccountInvitations_AsContributor_Returns403()
    {
        // Arrange — AC: #6 — Contributor cannot access
        var contributorEmail = $"contributor{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(contributorEmail, "Test@123456", "Contributor");
        var token = await GetAccessTokenAsync(contributorEmail, "Test@123456");

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/invitations");
        request.Headers.Add("Authorization", $"Bearer {token}");
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== RESEND INVITATION TESTS ====================

    [Fact]
    public async Task ResendInvitation_ExpiredInvitation_Returns201AndSendsEmail()
    {
        // Arrange — AC: #4 — resend an expired invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        var (_, ownerAccountId) = await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Create an expired invitation directly in database
        var inviteeEmail = $"expired{Guid.NewGuid():N}@example.com";
        var rawCode = GenerateSecureCode();
        var codeHash = ComputeHash(rawCode);
        Guid invitationId;

        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var invitation = new Invitation
            {
                Email = inviteeEmail,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                ExpiresAt = DateTime.UtcNow.AddDays(-1), // Expired
                AccountId = ownerAccountId,
                Role = "Contributor"
            };
            dbContext.Invitations.Add(invitation);
            await dbContext.SaveChangesAsync();
            invitationId = invitation.Id;
        }

        // Clear email log to isolate
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var emailCountBefore = fakeEmailService.SentInvitationEmails.Count;

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/invitations/{invitationId}/resend", new { }, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var content = await response.Content.ReadFromJsonAsync<ResendInvitationResponse>();
        content.Should().NotBeNull();
        content!.InvitationId.Should().NotBe(Guid.Empty);
        content.Message.Should().Contain("resent");

        // Verify email was sent
        fakeEmailService.SentInvitationEmails.Count.Should().BeGreaterThan(emailCountBefore);
    }

    [Fact]
    public async Task ResendInvitation_ActiveInvitation_Returns400()
    {
        // Arrange — cannot resend an active invitation
        var ownerEmail = $"owner{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(ownerEmail, "Test@123456", "Owner");
        var token = await GetAccessTokenAsync(ownerEmail, "Test@123456");

        // Create an active invitation
        var inviteeEmail = $"active{Guid.NewGuid():N}@example.com";
        var createRequest = new { Email = inviteeEmail, Role = "Owner" };
        var createResponse = await PostAsJsonWithAuthAsync("/api/v1/invitations", createRequest, token);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var createContent = await createResponse.Content.ReadFromJsonAsync<CreateInvitationResponse>();

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/invitations/{createContent!.InvitationId}/resend", new { }, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ResendInvitation_AsContributor_Returns403()
    {
        // Arrange — Contributor cannot resend
        var contributorEmail = $"contributor{Guid.NewGuid():N}@example.com";
        await _factory.CreateTestUserAsync(contributorEmail, "Test@123456", "Contributor");
        var token = await GetAccessTokenAsync(contributorEmail, "Test@123456");

        // Act
        var response = await PostAsJsonWithAuthAsync($"/api/v1/invitations/{Guid.NewGuid()}/resend", new { }, token);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
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

    private async Task<HttpResponseMessage> GetWithAuthAsync(string url, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Authorization", $"Bearer {token}");
        return await _client.SendAsync(request);
    }

    // Story 22.3 helpers — lifted from AdminLandlordInvitationsControllerTests
    // (duplication across integration test classes is accepted per project convention).

    /// <summary>
    /// Creates an Owner user, grants the PlatformAdmin claim, and returns a logged-in token.
    /// </summary>
    private async Task<(Guid UserId, Guid AccountId, string Token)> CreatePlatformAdminAsync()
    {
        var email = $"admin{Guid.NewGuid():N}@example.com";
        var (userId, accountId) = await _factory.CreateTestUserAsync(email, "Test@123456", "Owner");

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByIdAsync(userId.ToString())
                ?? throw new InvalidOperationException($"User {userId} not found");
            var result = await userManager.AddClaimAsync(
                user, new Claim(PlatformClaims.PlatformAdmin, "true"));
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to grant PlatformAdmin claim: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }
        }

        var token = await GetAccessTokenAsync(email, "Test@123456");
        return (userId, accountId, token);
    }

    /// <summary>
    /// Reads the raw landlord-invitation accept code captured by the fake email service.
    /// </summary>
    private string GetLandlordInvitationCode(string inviteeEmail)
    {
        var fakeEmailService = _factory.Services.GetRequiredService<FakeEmailService>();
        var sent = fakeEmailService.SentLandlordInvitationEmails
            .First(e => e.Email == inviteeEmail.ToLowerInvariant());
        return sent.Code;
    }

    // DTOs for deserialization
    private record CreateInvitationResponse(Guid InvitationId, string Message);
    private record ValidateInvitationResponse(bool IsValid, string? Email, string? Role, string? ErrorMessage);
    private record AcceptInvitationResponse(Guid UserId, string Email, string Message);
    private record ResendInvitationResponse(Guid InvitationId, string Message);
    private record GetAccountInvitationsResponse(List<InvitationItemDto> Items, int TotalCount);
    private record InvitationItemDto(Guid Id, string Email, string Role, DateTime CreatedAt, DateTime ExpiresAt, DateTime? UsedAt, string Status);
    private record LoginResponse(string AccessToken, int ExpiresIn);

    // Generic list-envelope shape { items, totalCount } used by list endpoints (AC-22.3.2, .7).
    private record ListEnvelope(List<System.Text.Json.JsonElement> Items, int TotalCount);
}
