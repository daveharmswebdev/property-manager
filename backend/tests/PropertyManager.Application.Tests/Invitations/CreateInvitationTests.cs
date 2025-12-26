using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Invitations;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Invitations;

/// <summary>
/// Unit tests for CreateInvitationHandler (AC: TD.6.2, TD.6.3).
/// </summary>
public class CreateInvitationTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IIdentityService> _mockIdentityService;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly Mock<ILogger<CreateInvitationCommandHandler>> _mockLogger;
    private readonly CreateInvitationCommandHandler _handler;

    public CreateInvitationTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockIdentityService = new Mock<IIdentityService>();
        _mockEmailService = new Mock<IEmailService>();
        _mockLogger = new Mock<ILogger<CreateInvitationCommandHandler>>();

        _handler = new CreateInvitationCommandHandler(
            _mockDbContext.Object,
            _mockIdentityService.Object,
            _mockEmailService.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task Handle_ValidEmail_CreatesInvitationAndSendsEmail()
    {
        // Arrange
        var email = "newuser@example.com";
        var command = new CreateInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.AsQueryable().BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _mockEmailService.Setup(x => x.SendInvitationEmailAsync(
            email.ToLowerInvariant(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.InvitationId.Should().NotBe(Guid.Empty);
        result.Message.Should().Contain("successfully");

        _mockEmailService.Verify(x => x.SendInvitationEmailAsync(
            email.ToLowerInvariant(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);

        invitations.Should().HaveCount(1);
        invitations[0].Email.Should().Be(email.ToLowerInvariant());
        invitations[0].CodeHash.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Handle_EmailAlreadyRegistered_ThrowsValidationException()
    {
        // Arrange
        var email = "existing@example.com";
        var command = new CreateInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*already registered*");
    }

    [Fact]
    public async Task Handle_PendingInvitationExists_ThrowsValidationException()
    {
        // Arrange
        var email = "pending@example.com";
        var command = new CreateInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var existingInvitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = email.ToLowerInvariant(),
            CodeHash = "existing-hash",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(12), // Not expired
            UsedAt = null // Not used
        };

        var invitations = new List<Invitation> { existingInvitation };
        var mockDbSet = invitations.AsQueryable().BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*pending invitation*");
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validator_EmptyEmail_Fails(string? email)
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand(email!);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email");
    }

    [Fact]
    public void Validator_InvalidEmailFormat_Fails()
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("not-an-email");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email" && e.ErrorMessage.Contains("Invalid email"));
    }

    [Fact]
    public void Validator_ValidEmail_Passes()
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
