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
/// Unit tests for ResendLandlordInvitationCommandHandler (Story 22.4, AC: #6).
/// Looks up by AccountId == null, re-creates a null-account Owner invitation,
/// and sends the landlord-flavored email (not co-owner or tenant).
/// </summary>
public class ResendLandlordInvitationTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly Mock<ICurrentUser> _mockCurrentUser;
    private readonly Mock<ILogger<ResendLandlordInvitationCommandHandler>> _mockLogger;
    private readonly ResendLandlordInvitationCommandHandler _handler;

    private readonly Guid _adminUserId = Guid.NewGuid();

    public ResendLandlordInvitationTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockEmailService = new Mock<IEmailService>();
        _mockCurrentUser = new Mock<ICurrentUser>();
        _mockLogger = new Mock<ILogger<ResendLandlordInvitationCommandHandler>>();

        _mockCurrentUser.Setup(x => x.UserId).Returns(_adminUserId);

        _handler = new ResendLandlordInvitationCommandHandler(
            _mockDbContext.Object,
            _mockEmailService.Object,
            _mockCurrentUser.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task Handle_ExpiredLandlordInvitation_CreatesFreshNullAccountOwnerAndSendsLandlordEmail()
    {
        // Arrange — AC: 22.4 #6
        var original = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "landlord@example.com",
            CodeHash = "old-hash",
            Role = "Owner",
            AccountId = null,
            InvitedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(-1), // Expired
            UsedAt = null
        };

        var invitations = new List<Invitation> { original };
        var mockDbSet = invitations.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new ResendLandlordInvitationCommand(original.Id);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.InvitationId.Should().NotBe(Guid.Empty);
        result.Message.Should().Contain("resent");

        invitations.Should().HaveCount(2);
        var created = invitations[1];
        created.Email.Should().Be("landlord@example.com");
        created.AccountId.Should().BeNull();
        created.Role.Should().Be("Owner");
        created.PropertyId.Should().BeNull();
        created.InvitedByUserId.Should().Be(_adminUserId);
        created.CodeHash.Should().NotBe("old-hash");
        created.ExpiresAt.Should().BeAfter(DateTime.UtcNow.AddHours(23));

        _mockEmailService.Verify(x => x.SendLandlordInvitationEmailAsync(
            "landlord@example.com", It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        _mockEmailService.Verify(x => x.SendInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _mockEmailService.Verify(x => x.SendTenantInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

        _mockDbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NoMatchingNullAccountInvitation_ThrowsNotFoundException()
    {
        // Arrange — an account-scoped invitation must NOT be resendable through this handler
        var accountScoped = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "scoped@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            UsedAt = null
        };

        var mockDbSet = new List<Invitation> { accountScoped }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendLandlordInvitationCommand(accountScoped.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_UsedInvitation_ThrowsValidationException()
    {
        // Arrange — AC: 22.4 #6 — cannot resend a used invitation
        var used = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "used@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = null,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            UsedAt = DateTime.UtcNow.AddDays(-1)
        };

        var mockDbSet = new List<Invitation> { used }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendLandlordInvitationCommand(used.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*used*");
    }

    [Fact]
    public async Task Handle_NotYetExpiredInvitation_ThrowsValidationException()
    {
        // Arrange — AC: 22.4 #6 — can only resend expired invitations
        var active = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = "active@example.com",
            CodeHash = "h",
            Role = "Owner",
            AccountId = null,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
            ExpiresAt = DateTime.UtcNow.AddHours(23),
            UsedAt = null
        };

        var mockDbSet = new List<Invitation> { active }.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        var command = new ResendLandlordInvitationCommand(active.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*expired*");
    }
}

/// <summary>
/// Unit tests for ResendLandlordInvitationCommandValidator.
/// </summary>
public class ResendLandlordInvitationValidatorTests
{
    [Fact]
    public void Validate_ValidId_Passes()
    {
        var validator = new ResendLandlordInvitationCommandValidator();
        var result = validator.Validate(new ResendLandlordInvitationCommand(Guid.NewGuid()));
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyId_Fails()
    {
        var validator = new ResendLandlordInvitationCommandValidator();
        var result = validator.Validate(new ResendLandlordInvitationCommand(Guid.Empty));
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "InvitationId");
    }
}
