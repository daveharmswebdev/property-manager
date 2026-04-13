using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequests;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for GetMaintenanceRequestsQueryHandler (AC #5, #6).
/// </summary>
public class GetMaintenanceRequestsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _property1Id = Guid.NewGuid();
    private readonly Guid _property2Id = Guid.NewGuid();

    public GetMaintenanceRequestsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _identityServiceMock = new Mock<IIdentityService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string>());
    }

    private GetMaintenanceRequestsQueryHandler CreateHandler()
    {
        return new GetMaintenanceRequestsQueryHandler(
            _dbContextMock.Object, _currentUserMock.Object, _identityServiceMock.Object);
    }

    private Property CreateProperty(Guid propertyId)
    {
        return new Property
        {
            Id = propertyId,
            AccountId = _testAccountId,
            Name = "Test Property",
            Street = "123 Main St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
    }

    private MaintenanceRequest CreateRequest(
        Guid propertyId, Property property, MaintenanceRequestStatus status = MaintenanceRequestStatus.Submitted,
        Guid? submittedByUserId = null, DateTime? createdAt = null)
    {
        return new MaintenanceRequest
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = propertyId,
            Property = property,
            SubmittedByUserId = submittedByUserId ?? Guid.NewGuid(),
            Status = status,
            Description = "Test request",
            CreatedAt = createdAt ?? DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupDbSet(List<MaintenanceRequest> requests)
    {
        // Simulate global query filter: only same account, not deleted
        var filtered = requests
            .Where(r => r.AccountId == _testAccountId && r.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }

    [Fact]
    public async Task Handle_AsTenant_ReturnsOnlyRequestsForTenantProperty()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.PropertyId).Returns(_property1Id);

        var property1 = CreateProperty(_property1Id);
        var property2 = CreateProperty(_property2Id);

        var requests = new List<MaintenanceRequest>
        {
            CreateRequest(_property1Id, property1),
            CreateRequest(_property2Id, property2)
        };
        SetupDbSet(requests);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].PropertyId.Should().Be(_property1Id);
    }

    [Fact]
    public async Task Handle_AsTenant_ReturnsRequestsFromOtherTenantsOnSameProperty()
    {
        // Arrange - shared visibility: tenant sees all requests on their property
        var otherTenantId = Guid.NewGuid();
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.PropertyId).Returns(_property1Id);

        var property1 = CreateProperty(_property1Id);

        var requests = new List<MaintenanceRequest>
        {
            CreateRequest(_property1Id, property1, submittedByUserId: _testUserId),
            CreateRequest(_property1Id, property1, submittedByUserId: otherTenantId)
        };
        SetupDbSet(requests);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_AsOwner_ReturnsRequestsAcrossAllProperties()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var property1 = CreateProperty(_property1Id);
        var property2 = CreateProperty(_property2Id);

        var requests = new List<MaintenanceRequest>
        {
            CreateRequest(_property1Id, property1),
            CreateRequest(_property2Id, property2)
        };
        SetupDbSet(requests);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_AppliesStatusFilterCorrectly()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var property1 = CreateProperty(_property1Id);

        var requests = new List<MaintenanceRequest>
        {
            CreateRequest(_property1Id, property1, MaintenanceRequestStatus.Submitted),
            CreateRequest(_property1Id, property1, MaintenanceRequestStatus.InProgress)
        };
        SetupDbSet(requests);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestsQuery(Status: "Submitted"), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Status.Should().Be("Submitted");
    }

    [Fact]
    public async Task Handle_AppliesPaginationCorrectly()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var property1 = CreateProperty(_property1Id);

        var requests = Enumerable.Range(0, 5)
            .Select(i => CreateRequest(_property1Id, property1, createdAt: DateTime.UtcNow.AddMinutes(-i)))
            .ToList();
        SetupDbSet(requests);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestsQuery(Page: 2, PageSize: 2), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(5);
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(2);
        result.TotalPages.Should().Be(3);
    }

    [Fact]
    public async Task Handle_OrdersByCreatedAtDescending()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var property1 = CreateProperty(_property1Id);

        var oldRequest = CreateRequest(_property1Id, property1, createdAt: DateTime.UtcNow.AddDays(-2));
        var newRequest = CreateRequest(_property1Id, property1, createdAt: DateTime.UtcNow);

        SetupDbSet(new List<MaintenanceRequest> { oldRequest, newRequest });

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items[0].CreatedAt.Should().BeAfter(result.Items[1].CreatedAt);
    }
}
