using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Invitations;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Invitations;

/// <summary>
/// Unit tests for GetLandlordInvitationsQueryHandler (Story 22.4, AC: #3).
/// Returns only AccountId == null invitations, ordered by CreatedAt desc,
/// with status derivation and InvitedBy display name resolution.
/// </summary>
public class GetLandlordInvitationsTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IIdentityService> _mockIdentityService;
    private readonly Mock<ILogger<GetLandlordInvitationsQueryHandler>> _mockLogger;
    private readonly GetLandlordInvitationsQueryHandler _handler;

    public GetLandlordInvitationsTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockIdentityService = new Mock<IIdentityService>();
        _mockLogger = new Mock<ILogger<GetLandlordInvitationsQueryHandler>>();

        _mockIdentityService
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string>());

        _handler = new GetLandlordInvitationsQueryHandler(
            _mockDbContext.Object,
            _mockIdentityService.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task Handle_ReturnsOnlyNullAccountInvitations_ExcludesAccountScoped()
    {
        // Arrange — AC: 22.4 #3 — only AccountId == null rows are landlord invitations
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "landlord1@example.com",
                CodeHash = "h1",
                Role = "Owner",
                AccountId = null,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Email = "accountscoped@example.com",
                CodeHash = "h2",
                Role = "Contributor",
                AccountId = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow.AddHours(-2),
                ExpiresAt = DateTime.UtcNow.AddHours(22)
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.TotalCount.Should().Be(1);
        result.Items[0].Email.Should().Be("landlord1@example.com");
    }

    [Fact]
    public async Task Handle_OrdersByCreatedAtDescending()
    {
        // Arrange — AC: 22.4 #3
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "older@example.com",
                CodeHash = "h1",
                Role = "Owner",
                AccountId = null,
                CreatedAt = DateTime.UtcNow.AddHours(-5),
                ExpiresAt = DateTime.UtcNow.AddHours(19)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Email = "newer@example.com",
                CodeHash = "h2",
                Role = "Owner",
                AccountId = null,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23)
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items[0].Email.Should().Be("newer@example.com");
        result.Items[1].Email.Should().Be("older@example.com");
    }

    [Theory]
    [InlineData(false, false, "Pending")]
    [InlineData(false, true, "Expired")]
    [InlineData(true, false, "Accepted")]
    public async Task Handle_DerivesStatusCorrectly(bool used, bool expired, string expectedStatus)
    {
        // Arrange — AC: 22.4 #3 — status derivation matches Settings (Pending/Expired/Accepted)
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "status@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = null,
            CreatedAt = DateTime.UtcNow.AddHours(-2),
            ExpiresAt = expired ? DateTime.UtcNow.AddHours(-1) : DateTime.UtcNow.AddHours(23),
            UsedAt = used ? DateTime.UtcNow.AddHours(-1) : null
        };

        var mockDbSet = new List<Invitation> { invitation }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items[0].Status.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task Handle_PopulatesInvitedByFromIdentityService()
    {
        // Arrange — AC: 22.4 #3 — InvitedBy resolved from the inviting user's display name
        var invitedByUserId = Guid.NewGuid();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "withinviter@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = null,
            InvitedByUserId = invitedByUserId,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23)
        };

        var mockDbSet = new List<Invitation> { invitation }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        _mockIdentityService
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string> { [invitedByUserId] = "Admin Person" });

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items[0].InvitedBy.Should().Be("Admin Person");
    }

    [Fact]
    public async Task Handle_InvitedByUserIdNull_ReturnsEmptyInvitedBy()
    {
        // Arrange — defensive: an invitation with no inviter resolves to empty string, not a crash
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "noinviter@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = null,
            InvitedByUserId = null,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23)
        };

        var mockDbSet = new List<Invitation> { invitation }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items[0].InvitedBy.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_NoInvitations_ReturnsEmptyResponse()
    {
        // Arrange — AC: 22.4 #3 — empty state
        var mockDbSet = new List<Invitation>().BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_MapsAllFieldsCorrectly()
    {
        // Arrange
        var id = Guid.NewGuid();
        var createdAt = DateTime.UtcNow.AddHours(-3);
        var expiresAt = DateTime.UtcNow.AddHours(21);
        var invitation = new Invitation
        {
            Id = id,
            Email = "fields@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = null,
            CreatedAt = createdAt,
            ExpiresAt = expiresAt,
            UsedAt = null
        };

        var mockDbSet = new List<Invitation> { invitation }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetLandlordInvitationsQuery(), CancellationToken.None);

        // Assert
        var dto = result.Items[0];
        dto.Id.Should().Be(id);
        dto.Email.Should().Be("fields@example.com");
        dto.CreatedAt.Should().Be(createdAt);
        dto.ExpiresAt.Should().Be(expiresAt);
        dto.UsedAt.Should().BeNull();
        dto.Status.Should().Be("Pending");
    }
}
