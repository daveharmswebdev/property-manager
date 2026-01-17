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
/// Unit tests for GetVendorQueryHandler (AC #10, #11).
/// </summary>
public class GetVendorHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetVendorQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetVendorHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetVendorQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_VendorExists_ReturnsVendorDetail()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe", "Michael");
        vendor.Phones = new List<PhoneNumber>
        {
            new("512-555-1234", "Mobile"),
            new("512-555-5678", "Office")
        };
        vendor.Emails = new List<string> { "john@example.com", "john.work@example.com" };

        var tradeTag = CreateTradeTag(_testAccountId, "Plumber");
        vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment
        {
            VendorId = vendorId,
            TradeTagId = tradeTag.Id,
            Vendor = vendor,
            TradeTag = tradeTag
        });

        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(vendorId);
        result.FirstName.Should().Be("John");
        result.MiddleName.Should().Be("Michael");
        result.LastName.Should().Be("Doe");
        result.FullName.Should().Be("John Michael Doe");
        result.Phones.Should().HaveCount(2);
        result.Phones[0].Number.Should().Be("512-555-1234");
        result.Phones[0].Label.Should().Be("Mobile");
        result.Emails.Should().HaveCount(2);
        result.Emails.Should().Contain("john@example.com");
        result.TradeTags.Should().HaveCount(1);
        result.TradeTags[0].Name.Should().Be("Plumber");
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var nonExistentId = Guid.NewGuid();
        SetupVendorsDbSet(new List<Vendor>());
        var query = new GetVendorQuery(nonExistentId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Vendor*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_VendorBelongsToOtherAccount_ThrowsNotFoundException()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _otherAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_VendorIsDeleted_ThrowsNotFoundException()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        vendor.DeletedAt = DateTime.UtcNow;
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_VendorWithNoPhones_ReturnsEmptyPhonesList()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        vendor.Phones = new List<PhoneNumber>();
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Phones.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_VendorWithNoEmails_ReturnsEmptyEmailsList()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        vendor.Emails = new List<string>();
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Emails.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_VendorWithNoTradeTags_ReturnsEmptyTagsList()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TradeTags.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_VendorWithMultipleTradeTags_ReturnsAllTags()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");

        var tag1 = CreateTradeTag(_testAccountId, "Plumber");
        var tag2 = CreateTradeTag(_testAccountId, "Electrician");

        vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment
        {
            VendorId = vendorId,
            TradeTagId = tag1.Id,
            Vendor = vendor,
            TradeTag = tag1
        });
        vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment
        {
            VendorId = vendorId,
            TradeTagId = tag2.Id,
            Vendor = vendor,
            TradeTag = tag2
        });

        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.TradeTags.Should().HaveCount(2);
        result.TradeTags.Select(t => t.Name).Should().Contain("Plumber", "Electrician");
    }

    [Fact]
    public async Task Handle_VendorWithNoMiddleName_FullNameIsFirstAndLast()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        var query = new GetVendorQuery(vendorId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.FullName.Should().Be("John Doe");
        result.MiddleName.Should().BeNull();
    }

    private Vendor CreateVendor(Guid id, Guid accountId, string firstName, string lastName, string? middleName = null)
    {
        return new Vendor
        {
            Id = id,
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

    private VendorTradeTag CreateTradeTag(Guid accountId, string name)
    {
        return new VendorTradeTag
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = name,
            CreatedAt = DateTime.UtcNow
        };
    }

    private void SetupVendorsDbSet(List<Vendor> vendors)
    {
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }
}
