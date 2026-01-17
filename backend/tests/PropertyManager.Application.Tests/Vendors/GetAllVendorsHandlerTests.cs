using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Vendors;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for GetAllVendorsQueryHandler (AC #6).
/// </summary>
public class GetAllVendorsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetAllVendorsQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetAllVendorsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetAllVendorsQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_NoVendors_ReturnsEmptyList()
    {
        // Arrange
        var vendors = new List<Vendor>();
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WithVendors_ReturnsAllForAccount()
    {
        // Arrange
        var vendors = new List<Vendor>
        {
            CreateVendor(_testAccountId, "John", "Doe"),
            CreateVendor(_testAccountId, "Jane", "Smith"),
            CreateVendor(_otherAccountId, "Other", "User")
        };
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(v => v.LastName == "Doe" || v.LastName == "Smith");
    }

    [Fact]
    public async Task Handle_VendorsSortedByLastNameThenFirstName()
    {
        // Arrange
        var vendors = new List<Vendor>
        {
            CreateVendor(_testAccountId, "Zach", "Anderson"),
            CreateVendor(_testAccountId, "Alex", "Brown"),
            CreateVendor(_testAccountId, "Mike", "Anderson")
        };
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].FullName.Should().Be("Mike Anderson");
        result.Items[1].FullName.Should().Be("Zach Anderson");
        result.Items[2].FullName.Should().Be("Alex Brown");
    }

    [Fact]
    public async Task Handle_ExcludesDeletedVendors()
    {
        // Arrange
        var activeVendor = CreateVendor(_testAccountId, "Active", "Vendor");
        var deletedVendor = CreateVendor(_testAccountId, "Deleted", "Vendor");
        deletedVendor.DeletedAt = DateTime.UtcNow;

        var vendors = new List<Vendor> { activeVendor, deletedVendor };
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].FirstName.Should().Be("Active");
    }

    [Fact]
    public async Task Handle_ReturnsCorrectVendorDto()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe", "Michael");
        var vendors = new List<Vendor> { vendor };
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Id.Should().Be(vendor.Id);
        dto.FirstName.Should().Be("John");
        dto.LastName.Should().Be("Doe");
        dto.FullName.Should().Be("John Michael Doe");
    }

    [Fact]
    public async Task Handle_FullNameWithoutMiddleName()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        var vendors = new List<Vendor> { vendor };
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].FullName.Should().Be("John Doe");
    }

    [Fact]
    public async Task Handle_MultiTenantIsolation_OnlyReturnsCurrentAccountVendors()
    {
        // Arrange
        var vendors = new List<Vendor>
        {
            CreateVendor(_testAccountId, "My", "Vendor1"),
            CreateVendor(_testAccountId, "My", "Vendor2"),
            CreateVendor(_otherAccountId, "Other", "Vendor1"),
            CreateVendor(_otherAccountId, "Other", "Vendor2"),
            CreateVendor(Guid.NewGuid(), "Third", "Vendor")
        };
        SetupVendorsDbSet(vendors);
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(v => v.FirstName == "My");
    }

    [Fact]
    public async Task Handle_ReturnsVendorsWithPhones()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        vendor.Phones = new List<PhoneNumber>
        {
            new PhoneNumber("512-555-1234", "Mobile"),
            new PhoneNumber("512-555-5678", "Office")
        };
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Phones.Should().HaveCount(2);
        dto.Phones[0].Number.Should().Be("512-555-1234");
        dto.Phones[0].Label.Should().Be("Mobile");
        dto.Phones[1].Number.Should().Be("512-555-5678");
        dto.Phones[1].Label.Should().Be("Office");
    }

    [Fact]
    public async Task Handle_ReturnsVendorsWithEmails()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        vendor.Emails = new List<string> { "john@example.com", "john.doe@work.com" };
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Emails.Should().HaveCount(2);
        dto.Emails[0].Should().Be("john@example.com");
        dto.Emails[1].Should().Be("john.doe@work.com");
    }

    [Fact]
    public async Task Handle_ReturnsVendorsWithTradeTags()
    {
        // Arrange
        var plumberTag = new VendorTradeTag { Id = Guid.NewGuid(), Name = "Plumber", AccountId = _testAccountId };
        var electricianTag = new VendorTradeTag { Id = Guid.NewGuid(), Name = "Electrician", AccountId = _testAccountId };
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        vendor.TradeTagAssignments = new List<VendorTradeTagAssignment>
        {
            new VendorTradeTagAssignment { VendorId = vendor.Id, TradeTagId = plumberTag.Id, TradeTag = plumberTag },
            new VendorTradeTagAssignment { VendorId = vendor.Id, TradeTagId = electricianTag.Id, TradeTag = electricianTag }
        };
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.TradeTags.Should().HaveCount(2);
        dto.TradeTags.Should().Contain(t => t.Name == "Plumber");
        dto.TradeTags.Should().Contain(t => t.Name == "Electrician");
    }

    [Fact]
    public async Task Handle_VendorWithNoContactInfo_ReturnsEmptyLists()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        // Phones and Emails are already empty by default from CreateVendor
        // TradeTagAssignments is empty collection by default
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Phones.Should().BeEmpty();
        dto.Emails.Should().BeEmpty();
        dto.TradeTags.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_VendorsSortedByLastNameThenFirstName_WithEnhancedData()
    {
        // Arrange - verify sorting still works with phones/emails/tags populated
        var plumberTag = new VendorTradeTag { Id = Guid.NewGuid(), Name = "Plumber", AccountId = _testAccountId };

        var vendor1 = CreateVendor(_testAccountId, "Zach", "Anderson");
        vendor1.Phones = new List<PhoneNumber> { new PhoneNumber("111-111-1111", "Mobile") };
        vendor1.TradeTagAssignments = new List<VendorTradeTagAssignment>
        {
            new VendorTradeTagAssignment { VendorId = vendor1.Id, TradeTagId = plumberTag.Id, TradeTag = plumberTag }
        };

        var vendor2 = CreateVendor(_testAccountId, "Alex", "Brown");
        vendor2.Emails = new List<string> { "alex@example.com" };

        var vendor3 = CreateVendor(_testAccountId, "Mike", "Anderson");

        SetupVendorsDbSet(new List<Vendor> { vendor1, vendor2, vendor3 });
        var query = new GetAllVendorsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert - sorted by LastName, then FirstName
        result.Items.Should().HaveCount(3);
        result.Items[0].FullName.Should().Be("Mike Anderson");
        result.Items[0].Phones.Should().BeEmpty();
        result.Items[1].FullName.Should().Be("Zach Anderson");
        result.Items[1].Phones.Should().HaveCount(1);
        result.Items[1].TradeTags.Should().HaveCount(1);
        result.Items[2].FullName.Should().Be("Alex Brown");
        result.Items[2].Emails.Should().HaveCount(1);
    }

    private Vendor CreateVendor(Guid accountId, string firstName, string lastName, string? middleName = null)
    {
        return new Vendor
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FirstName = firstName,
            MiddleName = middleName,
            LastName = lastName,
            Phones = new List<PhoneNumber>(),
            Emails = new List<string>(),
            TradeTagAssignments = new List<VendorTradeTagAssignment>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupVendorsDbSet(List<Vendor> vendors)
    {
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }
}
