using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequestPhotos;
using PropertyManager.Application.MaintenanceRequests;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for GetMaintenanceRequestByIdQueryHandler (AC #7).
/// </summary>
public class GetMaintenanceRequestByIdHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IIdentityService> _identityServiceMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _property1Id = Guid.NewGuid();
    private readonly Guid _property2Id = Guid.NewGuid();

    public GetMaintenanceRequestByIdHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _identityServiceMock = new Mock<IIdentityService>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/photo.jpg");
        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/thumbnail.jpg");
    }

    private GetMaintenanceRequestByIdQueryHandler CreateHandler()
    {
        return new GetMaintenanceRequestByIdQueryHandler(
            _dbContextMock.Object, _currentUserMock.Object, _identityServiceMock.Object, _photoServiceMock.Object);
    }

    private void SetupDbSet(List<MaintenanceRequest> requests)
    {
        var filtered = requests
            .Where(r => r.AccountId == _testAccountId && r.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }

    [Fact]
    public async Task Handle_ReturnsFullDetailWithPropertyInfoAndSubmitterName()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var requestId = Guid.NewGuid();
        var submitterId = Guid.NewGuid();
        var property = new Property
        {
            Id = _property1Id,
            AccountId = _testAccountId,
            Name = "Sunset Apartments",
            Street = "123 Main St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        var maintenanceRequest = new MaintenanceRequest
        {
            Id = requestId,
            AccountId = _testAccountId,
            PropertyId = _property1Id,
            Property = property,
            SubmittedByUserId = submitterId,
            Description = "Broken window",
            Status = MaintenanceRequestStatus.Submitted,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupDbSet(new List<MaintenanceRequest> { maintenanceRequest });

        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string> { { submitterId, "John Tenant" } });

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestByIdQuery(requestId), CancellationToken.None);

        // Assert
        result.Id.Should().Be(requestId);
        result.PropertyName.Should().Be("Sunset Apartments");
        result.PropertyAddress.Should().Be("123 Main St, Austin, TX 78701");
        result.Description.Should().Be("Broken window");
        result.SubmittedByUserName.Should().Be("John Tenant");
        result.Status.Should().Be("Submitted");
    }

    [Fact]
    public async Task Handle_NonExistentId_ThrowsNotFoundException()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);
        SetupDbSet(new List<MaintenanceRequest>());

        var handler = CreateHandler();

        // Act
        var act = () => handler.Handle(new GetMaintenanceRequestByIdQuery(Guid.NewGuid()), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_AsTenant_ThrowsNotFoundForRequestOnDifferentProperty()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.PropertyId).Returns(_property1Id);

        var requestId = Guid.NewGuid();
        var property2 = new Property
        {
            Id = _property2Id,
            AccountId = _testAccountId,
            Name = "Other Property",
            Street = "456 Oak Ave",
            City = "Dallas",
            State = "TX",
            ZipCode = "75201"
        };

        var maintenanceRequest = new MaintenanceRequest
        {
            Id = requestId,
            AccountId = _testAccountId,
            PropertyId = _property2Id,  // Different property!
            Property = property2,
            SubmittedByUserId = Guid.NewGuid(),
            Description = "Other property issue",
            Status = MaintenanceRequestStatus.Submitted,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupDbSet(new List<MaintenanceRequest> { maintenanceRequest });

        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string>());

        var handler = CreateHandler();

        // Act
        var act = () => handler.Handle(new GetMaintenanceRequestByIdQuery(requestId), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_AsOwner_CanAccessRequestFromAnyProperty()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var requestId = Guid.NewGuid();
        var property = new Property
        {
            Id = _property2Id,
            AccountId = _testAccountId,
            Name = "Any Property",
            Street = "789 Elm St",
            City = "Houston",
            State = "TX",
            ZipCode = "77001"
        };

        var maintenanceRequest = new MaintenanceRequest
        {
            Id = requestId,
            AccountId = _testAccountId,
            PropertyId = _property2Id,
            Property = property,
            SubmittedByUserId = Guid.NewGuid(),
            Description = "Fix it",
            Status = MaintenanceRequestStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupDbSet(new List<MaintenanceRequest> { maintenanceRequest });

        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string>());

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestByIdQuery(requestId), CancellationToken.None);

        // Assert
        result.Id.Should().Be(requestId);
        result.PropertyId.Should().Be(_property2Id);
    }

    [Fact]
    public async Task Handle_DetailResponseIncludesPhotosWithPresignedUrls()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var requestId = Guid.NewGuid();
        var property = new Property
        {
            Id = _property1Id,
            AccountId = _testAccountId,
            Name = "Test Property",
            Street = "123 Main St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        var photos = new List<MaintenanceRequestPhoto>
        {
            new()
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                MaintenanceRequestId = requestId,
                StorageKey = $"{_testAccountId}/maintenancerequests/2026/photo1.jpg",
                ThumbnailStorageKey = $"{_testAccountId}/maintenancerequests/2026/thumbnails/photo1.jpg",
                OriginalFileName = "photo1.jpg",
                ContentType = "image/jpeg",
                FileSizeBytes = 1024,
                DisplayOrder = 0,
                IsPrimary = true,
                CreatedByUserId = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };

        var maintenanceRequest = new MaintenanceRequest
        {
            Id = requestId,
            AccountId = _testAccountId,
            PropertyId = _property1Id,
            Property = property,
            SubmittedByUserId = Guid.NewGuid(),
            Description = "Broken window",
            Status = MaintenanceRequestStatus.Submitted,
            Photos = photos,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupDbSet(new List<MaintenanceRequest> { maintenanceRequest });

        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string>());

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestByIdQuery(requestId), CancellationToken.None);

        // Assert
        result.Photos.Should().NotBeNull();
        result.Photos.Should().HaveCount(1);
        result.Photos![0].ViewUrl.Should().Be("https://example.com/photo.jpg");
        result.Photos[0].ThumbnailUrl.Should().Be("https://example.com/thumbnail.jpg");
        result.Photos[0].IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_DetailResponseWithNoPhotos_ReturnsEmptyList()
    {
        // Arrange
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        var requestId = Guid.NewGuid();
        var property = new Property
        {
            Id = _property1Id,
            AccountId = _testAccountId,
            Name = "Test Property",
            Street = "123 Main St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };

        var maintenanceRequest = new MaintenanceRequest
        {
            Id = requestId,
            AccountId = _testAccountId,
            PropertyId = _property1Id,
            Property = property,
            SubmittedByUserId = Guid.NewGuid(),
            Description = "Broken window",
            Status = MaintenanceRequestStatus.Submitted,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupDbSet(new List<MaintenanceRequest> { maintenanceRequest });

        _identityServiceMock
            .Setup(x => x.GetUserDisplayNamesAsync(It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, string>());

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(new GetMaintenanceRequestByIdQuery(requestId), CancellationToken.None);

        // Assert
        result.Photos.Should().NotBeNull();
        result.Photos.Should().BeEmpty();
    }
}
