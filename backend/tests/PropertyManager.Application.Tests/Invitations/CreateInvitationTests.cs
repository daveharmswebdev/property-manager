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
/// Unit tests for CreateInvitationHandler (AC: #1, #5).
/// </summary>
public class CreateInvitationTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IIdentityService> _mockIdentityService;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly Mock<ICurrentUser> _mockCurrentUser;
    private readonly Mock<ILogger<CreateInvitationCommandHandler>> _mockLogger;
    private readonly CreateInvitationCommandHandler _handler;

    private readonly Guid _ownerAccountId = Guid.NewGuid();
    private readonly Guid _ownerUserId = Guid.NewGuid();

    public CreateInvitationTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockIdentityService = new Mock<IIdentityService>();
        _mockEmailService = new Mock<IEmailService>();
        _mockCurrentUser = new Mock<ICurrentUser>();
        _mockLogger = new Mock<ILogger<CreateInvitationCommandHandler>>();

        _mockCurrentUser.Setup(x => x.AccountId).Returns(_ownerAccountId);
        _mockCurrentUser.Setup(x => x.UserId).Returns(_ownerUserId);

        _handler = new CreateInvitationCommandHandler(
            _mockDbContext.Object,
            _mockIdentityService.Object,
            _mockEmailService.Object,
            _mockCurrentUser.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task Handle_ValidEmail_CreatesInvitationAndSendsEmail()
    {
        // Arrange
        var email = "newuser@example.com";
        var command = new CreateInvitationCommand(email, "Owner");

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
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
    public async Task Handle_ValidEmail_StoresAccountIdRoleAndInvitedByUserId()
    {
        // Arrange — AC: #1 — invitation stores AccountId, Role, InvitedByUserId from ICurrentUser
        var email = "newuser@example.com";
        var command = new CreateInvitationCommand(email, "Contributor");

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _mockEmailService.Setup(x => x.SendInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        invitations.Should().HaveCount(1);
        invitations[0].AccountId.Should().Be(_ownerAccountId);
        invitations[0].InvitedByUserId.Should().Be(_ownerUserId);
        invitations[0].Role.Should().Be("Contributor");
    }

    [Fact]
    public async Task Handle_ValidEmailWithContributorRole_CreatesInvitationWithContributorRole()
    {
        // Arrange — AC: #1
        var email = "contributor@example.com";
        var command = new CreateInvitationCommand(email, "Contributor");

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _mockEmailService.Setup(x => x.SendInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        invitations[0].Role.Should().Be("Contributor");
    }

    [Fact]
    public async Task Handle_EmailAlreadyRegistered_ThrowsValidationException()
    {
        // Arrange
        var email = "existing@example.com";
        var command = new CreateInvitationCommand(email, "Owner");

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
        var command = new CreateInvitationCommand(email, "Owner");

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
        var mockDbSet = invitations.BuildMockDbSet();
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
        var command = new CreateInvitationCommand(email!, "Owner");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email" && e.ErrorMessage == "Email is required");
    }

    [Fact]
    public void Validator_InvalidEmailFormat_Fails()
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("not-an-email", "Owner");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email" && e.ErrorMessage == "Invalid email format");
    }

    [Fact]
    public void Validator_ValidEmail_Passes()
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", "Owner");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Handle_InvalidRole_ThrowsValidationException()
    {
        // Arrange — AC: validator rejects invalid roles
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", "Admin");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Role" && e.ErrorMessage == "Role must be 'Owner', 'Contributor', or 'Tenant'");
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validator_EmptyRole_Fails(string? role)
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", role!);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Role" && e.ErrorMessage == "Role is required");
    }

    [Theory]
    [InlineData("Owner")]
    [InlineData("Contributor")]
    public void Validator_ValidRole_Passes(string role)
    {
        // Arrange
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", role);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    // === Story 20.2 Tests ===

    [Fact]
    public async Task Handle_TenantRoleWithValidPropertyId_CreatesInvitationWithPropertyId()
    {
        // Arrange — AC: 20.2 #1 — Tenant invitation stores PropertyId
        var propertyId = Guid.NewGuid();
        var email = "tenant@example.com";
        var command = new CreateInvitationCommand(email, "Tenant", propertyId);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var properties = new List<Property>
        {
            new Property { Id = propertyId, AccountId = _ownerAccountId, Street = "123 Main St", City = "Austin", State = "TX", ZipCode = "78701" }
        };
        var mockPropertySet = properties.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Properties).Returns(mockPropertySet.Object);

        _mockEmailService.Setup(x => x.SendTenantInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        invitations.Should().HaveCount(1);
        invitations[0].PropertyId.Should().Be(propertyId);
        invitations[0].Role.Should().Be("Tenant");
    }

    [Fact]
    public async Task Handle_TenantRoleWithPropertyFromDifferentAccount_ThrowsValidationException()
    {
        // Arrange — AC: 20.2 #5 — PropertyId must belong to landlord's account
        var propertyId = Guid.NewGuid();
        var otherAccountId = Guid.NewGuid();
        var email = "tenant@example.com";
        var command = new CreateInvitationCommand(email, "Tenant", propertyId);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // Property belongs to a different account
        var properties = new List<Property>
        {
            new Property { Id = propertyId, AccountId = otherAccountId, Street = "123 Main St", City = "Austin", State = "TX", ZipCode = "78701" }
        };
        var mockPropertySet = properties.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Properties).Returns(mockPropertySet.Object);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*Property not found*");
    }

    [Fact]
    public async Task Handle_TenantRoleWithNonExistentPropertyId_ThrowsValidationException()
    {
        // Arrange — AC: 20.2 #5 — PropertyId must exist
        var propertyId = Guid.NewGuid();
        var email = "tenant@example.com";
        var command = new CreateInvitationCommand(email, "Tenant", propertyId);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);

        // No matching property exists
        var properties = new List<Property>();
        var mockPropertySet = properties.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Properties).Returns(mockPropertySet.Object);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*Property not found*");
    }

    [Fact]
    public async Task Handle_TenantRole_CallsSendTenantInvitationEmailWithPropertyAddress()
    {
        // Arrange — AC: 20.2 #4 — tenant email includes property address
        var propertyId = Guid.NewGuid();
        var email = "tenant@example.com";
        var command = new CreateInvitationCommand(email, "Tenant", propertyId);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email.ToLowerInvariant(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var invitations = new List<Invitation>();
        var mockDbSet = invitations.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            inv.Id = Guid.NewGuid();
            invitations.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockDbSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var properties = new List<Property>
        {
            new Property { Id = propertyId, AccountId = _ownerAccountId, Street = "123 Main St", City = "Austin", State = "TX", ZipCode = "78701" }
        };
        var mockPropertySet = properties.BuildMockDbSet();
        _mockDbContext.Setup(x => x.Properties).Returns(mockPropertySet.Object);

        _mockEmailService.Setup(x => x.SendTenantInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _mockEmailService.Verify(x => x.SendTenantInvitationEmailAsync(
            email.ToLowerInvariant(),
            It.IsAny<string>(),
            "123 Main St, Austin, TX 78701",
            It.IsAny<CancellationToken>()), Times.Once);

        // Generic email should NOT be called
        _mockEmailService.Verify(x => x.SendInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void Validator_TenantRole_IsValid()
    {
        // Arrange — AC: 20.2 #1 — "Tenant" is a valid role
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", "Tenant", Guid.NewGuid());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_TenantRole_PropertyIdRequired()
    {
        // Arrange — AC: 20.2 #1 — PropertyId is required when role is Tenant
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", "Tenant", null);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PropertyId" && e.ErrorMessage == "PropertyId is required for Tenant invitations");
    }

    [Fact]
    public void Validator_OwnerRole_PropertyIdMustBeNull()
    {
        // Arrange — AC: 20.2 — PropertyId should only be set for Tenant role
        var validator = new CreateInvitationCommandValidator();
        var command = new CreateInvitationCommand("valid@example.com", "Owner", Guid.NewGuid());

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PropertyId" && e.ErrorMessage == "PropertyId should only be set for Tenant invitations");
    }
}
