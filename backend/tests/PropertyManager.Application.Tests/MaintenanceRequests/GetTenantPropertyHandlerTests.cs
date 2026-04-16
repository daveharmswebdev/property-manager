using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequests;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for GetTenantPropertyQueryHandler (Story 20.5, AC #2).
/// </summary>
public class GetTenantPropertyHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public GetTenantPropertyHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
    }

    private GetTenantPropertyQueryHandler CreateHandler()
    {
        return new GetTenantPropertyQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    private void SetupDbSet(List<Property> properties)
    {
        var filtered = properties
            .Where(p => p.AccountId == _testAccountId && p.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    [Fact]
    public async Task Handle_ValidPropertyId_ReturnsPropertyInfo()
    {
        // Arrange
        _currentUserMock.Setup(x => x.PropertyId).Returns(_testPropertyId);

        var property = new Property
        {
            Id = _testPropertyId,
            AccountId = _testAccountId,
            Name = "Sunset Apartments",
            Street = "123 Main St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        SetupDbSet(new List<Property> { property });

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetTenantPropertyQuery(), CancellationToken.None);

        // Assert
        result.Id.Should().Be(_testPropertyId);
        result.Name.Should().Be("Sunset Apartments");
        result.Street.Should().Be("123 Main St");
        result.City.Should().Be("Austin");
        result.State.Should().Be("TX");
        result.ZipCode.Should().Be("78701");
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        _currentUserMock.Setup(x => x.PropertyId).Returns(Guid.NewGuid());

        SetupDbSet(new List<Property>());

        var handler = CreateHandler();

        // Act
        var act = () => handler.Handle(new GetTenantPropertyQuery(), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_NullPropertyId_ThrowsBusinessRuleException()
    {
        // Arrange
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        SetupDbSet(new List<Property>());

        var handler = CreateHandler();

        // Act
        var act = () => handler.Handle(new GetTenantPropertyQuery(), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Handle_NonTenantRole_ThrowsBusinessRuleException()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns(_testPropertyId);

        SetupDbSet(new List<Property>());

        var handler = CreateHandler();

        // Act
        var act = () => handler.Handle(new GetTenantPropertyQuery(), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*Tenant*");
    }
}
