using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Invitations;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Invitations;

/// <summary>
/// Unit tests for GetAccountInvitationsQueryHandler (AC: #3, #4).
/// </summary>
public class GetAccountInvitationsTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<ICurrentUser> _mockCurrentUser;
    private readonly Mock<ILogger<GetAccountInvitationsQueryHandler>> _mockLogger;
    private readonly GetAccountInvitationsQueryHandler _handler;

    private readonly Guid _ownerAccountId = Guid.NewGuid();

    public GetAccountInvitationsTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockCurrentUser = new Mock<ICurrentUser>();
        _mockLogger = new Mock<ILogger<GetAccountInvitationsQueryHandler>>();

        _mockCurrentUser.Setup(x => x.AccountId).Returns(_ownerAccountId);

        _handler = new GetAccountInvitationsQueryHandler(
            _mockDbContext.Object,
            _mockCurrentUser.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task Handle_ReturnsInvitationsForCurrentAccount()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "user1@example.com",
                CodeHash = "hash1",
                Role = "Owner",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Email = "user2@example.com",
                CodeHash = "hash2",
                Role = "Contributor",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddHours(-2),
                ExpiresAt = DateTime.UtcNow.AddHours(22)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Email = "other@example.com",
                CodeHash = "hash3",
                Role = "Owner",
                AccountId = otherAccountId,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24)
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(i => i.Email == "user1@example.com" || i.Email == "user2@example.com");
    }

    [Fact]
    public async Task Handle_PendingInvitation_ReturnsStatusPending()
    {
        // Arrange — AC: #3 — active invitation shows "Pending"
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "pending@example.com",
                CodeHash = "hash",
                Role = "Owner",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23),
                UsedAt = null
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Status.Should().Be("Pending");
    }

    [Fact]
    public async Task Handle_ExpiredInvitation_ReturnsStatusExpired()
    {
        // Arrange — AC: #4 — expired invitation shows "Expired"
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "expired@example.com",
                CodeHash = "hash",
                Role = "Owner",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                ExpiresAt = DateTime.UtcNow.AddDays(-1),
                UsedAt = null
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Status.Should().Be("Expired");
    }

    [Fact]
    public async Task Handle_AcceptedInvitation_ReturnsStatusAccepted()
    {
        // Arrange — AC: #3 — used invitation shows "Accepted"
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "accepted@example.com",
                CodeHash = "hash",
                Role = "Contributor",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddHours(-5),
                ExpiresAt = DateTime.UtcNow.AddHours(19),
                UsedAt = DateTime.UtcNow.AddHours(-3)
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Status.Should().Be("Accepted");
    }

    [Fact]
    public async Task Handle_MapsAllFieldsCorrectly()
    {
        // Arrange
        var invitationId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow.AddHours(-1);
        var expiresAt = DateTime.UtcNow.AddHours(23);
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = invitationId,
                Email = "mapped@example.com",
                CodeHash = "hash",
                Role = "Contributor",
                AccountId = _ownerAccountId,
                CreatedAt = createdAt,
                ExpiresAt = expiresAt,
                UsedAt = null
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        var dto = result.Items[0];
        dto.Id.Should().Be(invitationId);
        dto.Email.Should().Be("mapped@example.com");
        dto.Role.Should().Be("Contributor");
        dto.CreatedAt.Should().Be(createdAt);
        dto.ExpiresAt.Should().Be(expiresAt);
        dto.UsedAt.Should().BeNull();
        dto.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task Handle_OrdersByCreatedAtDescending()
    {
        // Arrange
        var invitations = new List<Invitation>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Email = "first@example.com",
                CodeHash = "hash1",
                Role = "Owner",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddHours(-5),
                ExpiresAt = DateTime.UtcNow.AddHours(19)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Email = "latest@example.com",
                CodeHash = "hash2",
                Role = "Owner",
                AccountId = _ownerAccountId,
                CreatedAt = DateTime.UtcNow.AddHours(-1),
                ExpiresAt = DateTime.UtcNow.AddHours(23)
            }
        };

        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items[0].Email.Should().Be("latest@example.com");
        result.Items[1].Email.Should().Be("first@example.com");
    }

    [Fact]
    public async Task Handle_NoInvitations_ReturnsEmptyList()
    {
        // Arrange
        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var result = await _handler.Handle(new GetAccountInvitationsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }
}
