using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Properties;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Properties;

/// <summary>
/// Unit tests for GetPropertyByIdQueryHandler (AC-2.3.2, AC-2.3.5, AC-2.3.6).
/// </summary>
public class GetPropertyByIdHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetPropertyByIdQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetPropertyByIdHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetPropertyByIdQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidPropertyId_ReturnsPropertyDetailDto()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property", "Austin", "TX");
        property.Street = "123 Main Street";
        property.ZipCode = "78701";
        property.CreatedAt = new DateTime(2025, 1, 15, 10, 30, 0, DateTimeKind.Utc);
        property.UpdatedAt = new DateTime(2025, 1, 20, 14, 45, 0, DateTimeKind.Utc);

        var properties = new List<Property> { property };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(property.Id);
        result.Name.Should().Be("Test Property");
        result.Street.Should().Be("123 Main Street");
        result.City.Should().Be("Austin");
        result.State.Should().Be("TX");
        result.ZipCode.Should().Be("78701");
        result.CreatedAt.Should().Be(property.CreatedAt);
        result.UpdatedAt.Should().Be(property.UpdatedAt);
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ReturnsNull()
    {
        // Arrange
        var properties = new List<Property>();
        SetupPropertiesDbSet(properties);
        var nonExistentId = Guid.NewGuid();
        var query = new GetPropertyByIdQuery(nonExistentId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_PropertyBelongsToDifferentAccount_ReturnsNull()
    {
        // Arrange
        var otherAccountProperty = CreateProperty(_otherAccountId, "Other Account Property", "Houston", "TX");
        var properties = new List<Property> { otherAccountProperty };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(otherAccountProperty.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_DeletedProperty_ReturnsNull()
    {
        // Arrange
        var deletedProperty = CreateProperty(_testAccountId, "Deleted Property", "Dallas", "TX");
        deletedProperty.DeletedAt = DateTime.UtcNow;

        var properties = new List<Property> { deletedProperty };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(deletedProperty.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ReturnsExpenseAndIncomeTotalsAsZero()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property", "Austin", "TX");
        var properties = new List<Property> { property };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.ExpenseTotal.Should().Be(0m);
        result.IncomeTotal.Should().Be(0m);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyRecentExpensesAndIncomeArrays()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property", "Austin", "TX");
        var properties = new List<Property> { property };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(property.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.RecentExpenses.Should().BeEmpty();
        result.RecentIncome.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_WithMultipleProperties_ReturnsOnlyRequestedProperty()
    {
        // Arrange
        var property1 = CreateProperty(_testAccountId, "Property 1", "Austin", "TX");
        var property2 = CreateProperty(_testAccountId, "Property 2", "Dallas", "TX");
        var property3 = CreateProperty(_testAccountId, "Property 3", "Houston", "TX");

        var properties = new List<Property> { property1, property2, property3 };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(property2.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(property2.Id);
        result.Name.Should().Be("Property 2");
    }

    [Fact]
    public async Task Handle_EmptyGuid_ReturnsNull()
    {
        // Arrange
        var property = CreateProperty(_testAccountId, "Test Property", "Austin", "TX");
        var properties = new List<Property> { property };
        SetupPropertiesDbSet(properties);
        var query = new GetPropertyByIdQuery(Guid.Empty);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    private Property CreateProperty(Guid accountId, string name, string city, string state)
    {
        return new Property
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = name,
            Street = "123 Test Street",
            City = city,
            State = state,
            ZipCode = "12345",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }
}
