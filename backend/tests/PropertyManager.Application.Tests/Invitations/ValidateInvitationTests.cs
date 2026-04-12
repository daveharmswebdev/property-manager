using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Invitations;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Invitations;

/// <summary>
/// Unit tests for ValidateInvitationQueryHandler (AC: 20.2 #4, #7).
/// </summary>
public class ValidateInvitationQueryHandlerTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly ValidateInvitationQueryHandler _handler;

    public ValidateInvitationQueryHandlerTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _handler = new ValidateInvitationQueryHandler(_mockDbContext.Object);
    }

    private static string ComputeHash(string code)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(code));
        return Convert.ToBase64String(hashBytes);
    }

    [Fact]
    public async Task Handle_InvitationWithPropertyId_ReturnsPropertyAddress()
    {
        // Arrange — AC: 20.2 #4 — validate returns property address for tenant invitations
        var propertyId = Guid.NewGuid();
        var codeHash = ComputeHash("test-code");

        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "tenant@example.com",
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23),
            UsedAt = null,
            Role = "Tenant",
            PropertyId = propertyId,
            AccountId = Guid.NewGuid()
        };

        var invitations = new List<Invitation> { invitation };
        var mockInvitationSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockInvitationSet.Object);

        var properties = new List<Property>
        {
            new Property { Id = propertyId, AccountId = Guid.NewGuid(), Street = "456 Oak Ave", City = "Dallas", State = "TX", ZipCode = "75201" }
        };
        var mockPropertySet = properties.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Properties).Returns(mockPropertySet.Object);

        var query = new ValidateInvitationQuery("test-code");

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsValid.Should().BeTrue();
        result.Email.Should().Be("tenant@example.com");
        result.Role.Should().Be("Tenant");
        result.PropertyId.Should().Be(propertyId);
        result.PropertyAddress.Should().Be("456 Oak Ave, Dallas, TX 75201");
    }

    [Fact]
    public async Task Handle_InvitationWithoutPropertyId_ReturnsNullPropertyAddress()
    {
        // Arrange — AC: 20.2 — Owner/Contributor invitations have null property info
        var codeHash = ComputeHash("test-code");

        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "user@example.com",
            CodeHash = codeHash,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23),
            UsedAt = null,
            Role = "Owner",
            PropertyId = null,
            AccountId = Guid.NewGuid()
        };

        var invitations = new List<Invitation> { invitation };
        var mockInvitationSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockInvitationSet.Object);

        var query = new ValidateInvitationQuery("test-code");

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsValid.Should().BeTrue();
        result.Email.Should().Be("user@example.com");
        result.PropertyId.Should().BeNull();
        result.PropertyAddress.Should().BeNull();
    }
}
