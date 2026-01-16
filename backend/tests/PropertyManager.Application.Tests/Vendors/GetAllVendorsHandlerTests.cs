using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Vendors;
using PropertyManager.Domain.Entities;

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

    private Vendor CreateVendor(Guid accountId, string firstName, string lastName, string? middleName = null)
    {
        return new Vendor
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FirstName = firstName,
            MiddleName = middleName,
            LastName = lastName,
            Phones = new List<Domain.ValueObjects.PhoneNumber>(),
            Emails = new List<string>(),
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
