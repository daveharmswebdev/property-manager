using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Vendors;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for CreateVendorCommandHandler (AC #7).
/// </summary>
public class CreateVendorHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateVendorCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly List<Vendor> _addedVendors = new();

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

        _handler = new CreateVendorCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_CreatesVendorWithAccountId()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

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
        var command = new CreateVendorCommand("John", "Allen", "Doe");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].FirstName.Should().Be("John");
        _addedVendors[0].MiddleName.Should().Be("Allen");
        _addedVendors[0].LastName.Should().Be("Doe");
    }

    [Fact]
    public async Task Handle_ValidCommand_InitializesEmptyCollections()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].Phones.Should().BeEmpty();
        _addedVendors[0].Emails.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsVendorId()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        // Note: In unit tests, Id defaults to Guid.Empty from entity initializer
        // In production, EF Core/DB generates the Id
        _addedVendors.Should().HaveCount(1);
        result.Should().Be(_addedVendors[0].Id);
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsSaveChanges()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NullMiddleName_AcceptsNullMiddleName()
    {
        // Arrange
        var command = new CreateVendorCommand("John", null, "Doe");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedVendors.Should().HaveCount(1);
        _addedVendors[0].MiddleName.Should().BeNull();
    }
}
