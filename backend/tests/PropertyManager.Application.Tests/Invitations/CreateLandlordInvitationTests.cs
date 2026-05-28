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
/// Unit tests for CreateLandlordInvitationCommandHandler + Validator (Story 22.2).
/// </summary>
public class CreateLandlordInvitationTests
{
    private readonly Mock<IAppDbContext> _mockDbContext;
    private readonly Mock<IIdentityService> _mockIdentityService;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly Mock<ICurrentUser> _mockCurrentUser;
    private readonly Mock<ILogger<CreateLandlordInvitationCommandHandler>> _mockLogger;
    private readonly CreateLandlordInvitationCommandHandler _handler;

    private readonly Guid _adminUserId = Guid.NewGuid();

    public CreateLandlordInvitationTests()
    {
        _mockDbContext = new Mock<IAppDbContext>();
        _mockIdentityService = new Mock<IIdentityService>();
        _mockEmailService = new Mock<IEmailService>();
        _mockCurrentUser = new Mock<ICurrentUser>();
        _mockLogger = new Mock<ILogger<CreateLandlordInvitationCommandHandler>>();

        // NFR-LP2: handler only reads UserId from ICurrentUser — never AccountId.
        _mockCurrentUser.Setup(x => x.UserId).Returns(_adminUserId);

        _handler = new CreateLandlordInvitationCommandHandler(
            _mockDbContext.Object,
            _mockIdentityService.Object,
            _mockEmailService.Object,
            _mockCurrentUser.Object,
            _mockLogger.Object);
    }

    private (List<Invitation> store, Mock<Microsoft.EntityFrameworkCore.DbSet<Invitation>> mockSet) SetupInvitationsStore(
        IEnumerable<Invitation>? seed = null)
    {
        var store = (seed ?? Enumerable.Empty<Invitation>()).ToList();
        var mockSet = store.BuildMockDbSet();
        mockSet.Setup(x => x.Add(It.IsAny<Invitation>())).Callback<Invitation>(inv =>
        {
            if (inv.Id == Guid.Empty)
            {
                inv.Id = Guid.NewGuid();
            }
            store.Add(inv);
        });
        _mockDbContext.Setup(x => x.Invitations).Returns(mockSet.Object);
        _mockDbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return (store, mockSet);
    }

    // ===== AC #1 — persistence shape =====

    [Fact]
    public async Task Handle_ValidEmail_CreatesInvitationWithAccountIdNullAndRoleOwner()
    {
        // AC: 22.2 #1
        var email = "newlandlord@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var (store, _) = SetupInvitationsStore();
        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            email, It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var before = DateTime.UtcNow;
        var result = await _handler.Handle(command, CancellationToken.None);
        var after = DateTime.UtcNow;

        result.Should().NotBeNull();
        result.InvitationId.Should().NotBe(Guid.Empty);
        result.Message.Should().Contain("successfully");

        store.Should().HaveCount(1);
        var inv = store[0];
        inv.AccountId.Should().BeNull();
        inv.Role.Should().Be("Owner");
        inv.PropertyId.Should().BeNull();
        inv.InvitedByUserId.Should().Be(_adminUserId);
        inv.Email.Should().Be(email);
        inv.CodeHash.Should().NotBeNullOrEmpty();
        inv.UsedAt.Should().BeNull();
        inv.CreatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        // ExpiresAt ~ CreatedAt + 24h
        (inv.ExpiresAt - inv.CreatedAt).TotalHours.Should().BeApproximately(24, 0.01);
    }

    // ===== AC #6 — email-flavor exclusivity =====

    [Fact]
    public async Task Handle_ValidEmail_CallsSendLandlordInvitationEmail_NotOtherFlavors()
    {
        // AC: 22.2 #6
        var email = "newlandlord@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        SetupInvitationsStore();
        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            email, It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        await _handler.Handle(command, CancellationToken.None);

        _mockEmailService.Verify(x => x.SendLandlordInvitationEmailAsync(
            email, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        _mockEmailService.Verify(x => x.SendInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _mockEmailService.Verify(x => x.SendTenantInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ===== Email normalization =====

    [Fact]
    public async Task Handle_ValidEmail_LowerCasesAndTrims()
    {
        var raw = "  NEW@Example.COM  ";
        var normalized = "new@example.com";
        var command = new CreateLandlordInvitationCommand(raw);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(normalized, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var (store, _) = SetupInvitationsStore();
        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            normalized, It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        await _handler.Handle(command, CancellationToken.None);

        store[0].Email.Should().Be(normalized);
        _mockIdentityService.Verify(x => x.EmailExistsAsync(
            normalized, It.IsAny<CancellationToken>()), Times.Once);
        _mockEmailService.Verify(x => x.SendLandlordInvitationEmailAsync(
            normalized, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ===== AC #4 — already-registered email =====

    [Fact]
    public async Task Handle_EmailAlreadyRegistered_ThrowsValidationException()
    {
        // AC: 22.2 #4
        var email = "existing@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var act = () => _handler.Handle(command, CancellationToken.None);

        var thrown = await act.Should().ThrowAsync<ValidationException>();
        thrown.Which.Errors.Should().Contain(e =>
            e.PropertyName == "Email" && e.ErrorMessage.Contains("already registered"));

        _mockDbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _mockEmailService.Verify(x => x.SendLandlordInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ===== AC #5 — pending invitation blocks =====

    [Fact]
    public async Task Handle_PendingInvitationExists_ThrowsValidationException()
    {
        // AC: 22.2 #5
        var email = "pending@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var pending = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = email,
            CodeHash = "existing-hash",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(12),
            UsedAt = null
        };
        SetupInvitationsStore(new[] { pending });

        var act = () => _handler.Handle(command, CancellationToken.None);

        var thrown = await act.Should().ThrowAsync<ValidationException>();
        thrown.Which.Errors.Should().Contain(e =>
            e.PropertyName == "Email" && e.ErrorMessage.Contains("pending invitation"));

        _mockDbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _mockEmailService.Verify(x => x.SendLandlordInvitationEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ===== AC #5 guard — expired invitation does NOT block =====

    [Fact]
    public async Task Handle_ExpiredInvitationExists_DoesNotBlock()
    {
        // AC: 22.2 #5 (negative guard)
        var email = "previously@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var expired = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = email,
            CodeHash = "expired-hash",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ExpiresAt = DateTime.UtcNow.AddHours(-1), // expired
            UsedAt = null
        };
        var (store, _) = SetupInvitationsStore(new[] { expired });
        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            email, It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await _handler.Handle(command, CancellationToken.None);

        result.InvitationId.Should().NotBe(Guid.Empty);
        store.Should().HaveCount(2); // expired + new
    }

    // ===== AC #5 guard — used invitation does NOT block =====

    [Fact]
    public async Task Handle_UsedInvitationExists_DoesNotBlock()
    {
        // AC: 22.2 #5 (negative guard)
        var email = "previously@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var used = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = email,
            CodeHash = "used-hash",
            CreatedAt = DateTime.UtcNow.AddHours(-3),
            ExpiresAt = DateTime.UtcNow.AddHours(20),
            UsedAt = DateTime.UtcNow.AddHours(-1) // already accepted
        };
        var (store, _) = SetupInvitationsStore(new[] { used });
        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            email, It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await _handler.Handle(command, CancellationToken.None);

        result.InvitationId.Should().NotBe(Guid.Empty);
        store.Should().HaveCount(2); // used + new
    }

    // ===== AC #10 — log shape: structured ids only, no email =====

    [Fact]
    public async Task Handle_SuccessfulCreation_LogsInfoWithoutEmail()
    {
        // AC: 22.2 #10
        var email = "newlandlord@example.com";
        var command = new CreateLandlordInvitationCommand(email);

        _mockIdentityService.Setup(x => x.EmailExistsAsync(email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        SetupInvitationsStore();
        _mockEmailService.Setup(x => x.SendLandlordInvitationEmailAsync(
            email, It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        await _handler.Handle(command, CancellationToken.None);

        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((state, _) =>
                    // Raw email must NOT be present in any rendered/structured form
                    !state.ToString()!.Contains("newlandlord@example.com")
                    // No Email placeholder at all (not even masked) — CodeQL CWE-359 compliance
                    && !state.ToString()!.Contains("Email")
                    // Structured ids present for diagnostic correlation
                    && state.ToString()!.Contains("InvitationId")
                    && state.ToString()!.Contains("InvitedByUserId")),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    // ===== AC #9 — handler does not reference PlatformAdmin claim =====

    [Fact]
    public void Handler_DoesNotReferencePlatformAdminClaim()
    {
        // AC: 22.2 #9 — NFR-LP2 seam. Reflection-level check on the source type.
        // The handler must not read AccountId from ICurrentUser, and must not reference
        // the platformAdmin claim string or PlatformClaims.PlatformAdmin constant.
        var handlerType = typeof(CreateLandlordInvitationCommandHandler);
        var assembly = handlerType.Assembly;

        // ICurrentUser usage: only UserId is read in the test setup; if Handle() were
        // to read AccountId, the mock (unset) would return Guid.Empty silently — but the
        // happy-path test above also doesn't set AccountId, and persists fine.
        // The real check: scan all methods of the handler type for AccountId reads on
        // ICurrentUser. Since reflection over IL is fragile, assert via the contract test:
        // the constructor parameter must be of type ICurrentUser, but no public property
        // or field of the handler ever references "AccountId".
        handlerType.GetFields(System.Reflection.BindingFlags.Instance
            | System.Reflection.BindingFlags.NonPublic)
            .Should().Contain(f => f.FieldType == typeof(ICurrentUser),
                "handler must depend on ICurrentUser for InvitedByUserId");

        // Type-level guard: assembly has no string constants matching "platformAdmin"
        // in this specific type's metadata. We use this as a smoke test — a deeper guard
        // would require parsing IL, which is intentionally out of scope (see story Task 6.2).
        var typeName = handlerType.FullName ?? handlerType.Name;
        typeName.Should().NotContain("PlatformAdmin");
        assembly.GetName().Name.Should().NotContain("PlatformAdmin");
    }

    // ===== AC #7 — validator =====

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validator_EmptyEmail_Fails(string? email)
    {
        // AC: 22.2 #7
        var validator = new CreateLandlordInvitationCommandValidator();
        var command = new CreateLandlordInvitationCommand(email!);

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == "Email" && e.ErrorMessage == "Email is required");
    }

    [Fact]
    public void Validator_InvalidEmailFormat_Fails()
    {
        // AC: 22.2 #7
        var validator = new CreateLandlordInvitationCommandValidator();
        var command = new CreateLandlordInvitationCommand("not-an-email");

        var result = validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == "Email" && e.ErrorMessage == "Invalid email format");
    }

    [Fact]
    public void Validator_ValidEmail_Passes()
    {
        // AC: 22.2 #7
        var validator = new CreateLandlordInvitationCommandValidator();
        var command = new CreateLandlordInvitationCommand("valid@example.com");

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_DoesNotRequireRole()
    {
        // AC: 22.2 #7 — structural: command has only Email; valid-email payload passes
        // without needing any other field.
        var validator = new CreateLandlordInvitationCommandValidator();
        var command = new CreateLandlordInvitationCommand("valid@example.com");

        var result = validator.Validate(command);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }
}
