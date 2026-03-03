using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Vendors;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for CreateVendorCommandHandler (Story 17.8).
/// </summary>
public class CreateVendorHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateVendorCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly List<Vendor> _addedVendors = new();
    private readonly List<VendorTradeTag> _tradeTags = new();

    public CreateVendorHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        // Setup Vendors DbSet with Add tracking (uses synchronous Add, not AddAsync)
        var vendors = new List<Vendor>();
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Vendor>()))
            .Callback<Vendor>(v => _addedVendors.Add(v));
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        // Setup VendorTradeTags DbSet
        var mockTradeTagDbSet = _tradeTags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.VendorTradeTags).Returns(mockTradeTagDbSet.Object);

        _handler = new CreateVendorCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    private static CreateVendorCommand CreateCommand(
        string firstName = "John",
        string? middleName = null,
        string lastName = "Doe",
        List<PhoneNumberDto>? phones = null,
        List<string>? emails = null,
        List<Guid>? tradeTagIds = null)
    {
        return new CreateVendorCommand(
            firstName,
            middleName,
            lastName,
            phones ?? new List<PhoneNumberDto>(),
            emails ?? new List<string>(),
            tradeTagIds ?? new List<Guid>());
    }

    [Fact]
    public async Task Handle_ValidCommand_CreatesVendorWithAccountId()
    {
        // Arrange
        var command = CreateCommand();

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].AccountId.Should().Be(_testAccountId);
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsNameFields()
    {
        // Arrange
        var command = CreateCommand("John", "Allen", "Doe");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].FirstName.Should().Be("John");
        _addedVendors[0].MiddleName.Should().Be("Allen");
        _addedVendors[0].LastName.Should().Be("Doe");
    }

    [Fact]
    public async Task Handle_WithEmptyOptionalFields_CreatesVendorSuccessfully()
    {
        // Arrange — backward compatibility: no phones, emails, or tags
        var command = CreateCommand();

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].Phones.Should().BeEmpty();
        _addedVendors[0].Emails.Should().BeEmpty();
        _addedVendors[0].TradeTagAssignments.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsVendorId()
    {
        // Arrange
        var command = CreateCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        result.Should().Be(_addedVendors[0].Id);
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsSaveChanges()
    {
        // Arrange
        var command = CreateCommand();

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NullMiddleName_AcceptsNullMiddleName()
    {
        // Arrange
        var command = CreateCommand(middleName: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].MiddleName.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WithPhones_SetsPhoneNumbersOnVendor()
    {
        // Arrange
        var phones = new List<PhoneNumberDto>
        {
            new("512-555-1234", "Mobile"),
            new("512-555-5678", null)
        };
        var command = CreateCommand(phones: phones);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].Phones.Should().HaveCount(2);
        _addedVendors[0].Phones[0].Number.Should().Be("512-555-1234");
        _addedVendors[0].Phones[0].Label.Should().Be("Mobile");
        _addedVendors[0].Phones[1].Number.Should().Be("512-555-5678");
        _addedVendors[0].Phones[1].Label.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WithEmails_SetsEmailsOnVendor()
    {
        // Arrange
        var emails = new List<string> { "vendor@example.com", "alt@example.com" };
        var command = CreateCommand(emails: emails);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].Emails.Should().HaveCount(2);
        _addedVendors[0].Emails.Should().Contain("vendor@example.com");
        _addedVendors[0].Emails.Should().Contain("alt@example.com");
    }

    [Fact]
    public async Task Handle_WithTradeTagIds_CreatesVendorTradeTagAssignments()
    {
        // Arrange — add valid tags to the mock DbSet
        var tagId1 = Guid.NewGuid();
        var tagId2 = Guid.NewGuid();
        _tradeTags.AddRange(new[]
        {
            new VendorTradeTag { Id = tagId1, AccountId = _testAccountId, Name = "Plumbing" },
            new VendorTradeTag { Id = tagId2, AccountId = _testAccountId, Name = "HVAC" }
        });
        // Rebuild mock DbSet after adding tags
        var mockTradeTagDbSet = _tradeTags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.VendorTradeTags).Returns(mockTradeTagDbSet.Object);

        var command = CreateCommand(tradeTagIds: new List<Guid> { tagId1, tagId2 });

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].TradeTagAssignments.Should().HaveCount(2);
        _addedVendors[0].TradeTagAssignments.Select(a => a.TradeTagId).Should().Contain(tagId1);
        _addedVendors[0].TradeTagAssignments.Select(a => a.TradeTagId).Should().Contain(tagId2);
    }

    [Fact]
    public async Task Handle_WithInvalidTradeTagIds_ThrowsValidationException()
    {
        // Arrange — no tags in the DbSet, so any ID is invalid
        var invalidTagId = Guid.NewGuid();
        var command = CreateCommand(tradeTagIds: new List<Guid> { invalidTagId });

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>();
    }
}
