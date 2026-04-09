using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Invitations;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Invitations;

/// <summary>
/// Unit tests for ResendInvitationCommandHandler (AC: #4).
/// </summary>
public class ResendInvitationHandlerTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly Mock<ICurrentUser> _mockCurrentUser;
    private readonly Mock<ILogger<ResendInvitationCommandHandler>> _mockLogger;
    private readonly ResendInvitationCommandHandler _handler;

    private readonly Guid _ownerAccountId = Guid.NewGuid();
    private readonly Guid _ownerUserId = Guid.NewGuid();

    public ResendInvitationHandlerTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockEmailService = new Mock<IEmailService>();
        _mockCurrentUser = new Mock<ICurrentUser>();
        _mockLogger = new Mock<ILogger<ResendInvitationCommandHandler>>();

        _mockCurrentUser.Setup(x => x.AccountId).Returns(_ownerAccountId);
        _mockCurrentUser.Setup(x => x.UserId).Returns(_ownerUserId);

        _handler = new ResendInvitationCommandHandler(
            _mockDbContext.Object,
            _mockEmailService.Object,
            _mockCurrentUser.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task Handle_ExpiredUnusedInvitation_CreatesNewInvitationAndSendsEmail()
    {
        // Arrange — AC: #4 — resend creates new invitation for expired one
        var originalInvitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "expired@example.com",
            CodeHash = "old-hash",
            Role = "Contributor",
            AccountId = _ownerAccountId,
            InvitedByUserId = _ownerUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(-1), // Expired
            UsedAt = null
        };

        var invitations = new List<Invitation> { originalInvitation };
        var mockDbSet = invitations.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _mockEmailService.Setup(x => x.SendInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new ResendInvitationCommand(originalInvitation.Id);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.InvitationId.Should().NotBe(Guid.Empty);
        result.Message.Should().Contain("resent");

        // A new invitation was added
        invitations.Should().HaveCount(2);
        var newInvitation = invitations[1];
        newInvitation.Email.Should().Be("expired@example.com");
        newInvitation.Role.Should().Be("Contributor");
        newInvitation.AccountId.Should().Be(_ownerAccountId);
        newInvitation.InvitedByUserId.Should().Be(_ownerUserId);
        newInvitation.CodeHash.Should().NotBe("old-hash");

        _mockEmailService.Verify(x => x.SendInvitationEmailAsync(
            "expired@example.com", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);

        _mockDbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvitationNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendInvitationCommand(Guid.NewGuid());

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_InvitationFromDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "other@example.com",
            CodeHash = "hash",
            Role = "Owner",
            AccountId = otherAccountId,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            UsedAt = null
        };

        var invitations = new List<Invitation> { invitation };
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendInvitationCommand(invitation.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ActiveInvitation_ThrowsValidationException()
    {
        // Arrange — cannot resend an active (non-expired) invitation
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "active@example.com",
            CodeHash = "hash",
            Role = "Owner",
            AccountId = _ownerAccountId,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23), // Still active
            UsedAt = null
        };

        var invitations = new List<Invitation> { invitation };
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendInvitationCommand(invitation.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*expired*");
    }

    [Fact]
    public async Task Handle_UsedInvitation_ThrowsValidationException()
    {
        // Arrange — cannot resend a used invitation
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "used@example.com",
            CodeHash = "hash",
            Role = "Owner",
            AccountId = _ownerAccountId,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            UsedAt = DateTime.UtcNow.AddDays(-1) // Used
        };

        var invitations = new List<Invitation> { invitation };
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendInvitationCommand(invitation.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*used*");
    }
}

/// <summary>
/// Unit tests for ResendInvitationCommandValidator.
/// </summary>
public class ResendInvitationValidatorTests
{
    [Fact]
    public void Validate_ValidId_Passes()
    {
        var validator = new ResendInvitationCommandValidator();
        var command = new ResendInvitationCommand(Guid.NewGuid());
        var result = validator.Validate(command);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyId_Fails()
    {
        var validator = new ResendInvitationCommandValidator();
        var command = new ResendInvitationCommand(Guid.Empty);
        var result = validator.Validate(command);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "InvitationId");
    }
}
