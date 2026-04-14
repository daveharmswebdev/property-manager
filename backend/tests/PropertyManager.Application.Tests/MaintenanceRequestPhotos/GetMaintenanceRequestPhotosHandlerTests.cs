using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequestPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequestPhotos;

/// <summary>
/// Unit tests for GetMaintenanceRequestPhotosHandler (AC #5).
/// Tests photo retrieval with presigned URLs.
/// </summary>
public class GetMaintenanceRequestPhotosHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GetMaintenanceRequestPhotosHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testRequestId = Guid.NewGuid();

    public GetMaintenanceRequestPhotosHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(x => x.Role).Returns("Owner");
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);

        _photoServiceMock.Setup(x => x.GetPhotoUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/photo.jpg");
        _photoServiceMock.Setup(x => x.GetThumbnailUrlAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com/thumbnail.jpg");

        _handler = new GetMaintenanceRequestPhotosHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_RequestWithPhotos_ReturnsPhotosOrderedByDisplayOrder()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        var photos = new List<MaintenanceRequestPhoto>
        {
            CreatePhoto(_testAccountId, _testRequestId, isPrimary: false, displayOrder: 2),
            CreatePhoto(_testAccountId, _testRequestId, isPrimary: true, displayOrder: 0),
            CreatePhoto(_testAccountId, _testRequestId, isPrimary: false, displayOrder: 1)
        };

        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(photos);

        var query = new GetMaintenanceRequestPhotosQuery(_testRequestId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].DisplayOrder.Should().Be(0);
        result.Items[1].DisplayOrder.Should().Be(1);
        result.Items[2].DisplayOrder.Should().Be(2);
    }

    [Fact]
    public async Task Handle_MaintenanceRequestNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest>());
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());

        var query = new GetMaintenanceRequestPhotosQuery(Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_TenantAccessingRequestOnDifferentProperty_ThrowsNotFoundException()
    {
        // Arrange
        var tenantPropertyId = Guid.NewGuid();
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.PropertyId).Returns(tenantPropertyId);

        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId); // Different property
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());

        var query = new GetMaintenanceRequestPhotosQuery(_testRequestId);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_EmptyPhotoList_ReturnsEmptyItems()
    {
        // Arrange
        var request = CreateMaintenanceRequest(_testAccountId, _testPropertyId);
        SetupMaintenanceRequestsDbSet(new List<MaintenanceRequest> { request });
        SetupMaintenanceRequestPhotosDbSet(new List<MaintenanceRequestPhoto>());

        var query = new GetMaintenanceRequestPhotosQuery(_testRequestId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
    }

    private MaintenanceRequest CreateMaintenanceRequest(Guid accountId, Guid propertyId)
    {
        return new MaintenanceRequest
        {
            Id = _testRequestId,
            AccountId = accountId,
            PropertyId = propertyId,
            SubmittedByUserId = Guid.NewGuid(),
            Description = "Test request",
            Status = MaintenanceRequestStatus.Submitted,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private MaintenanceRequestPhoto CreatePhoto(Guid accountId, Guid requestId, bool isPrimary, int displayOrder)
    {
        return new MaintenanceRequestPhoto
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            MaintenanceRequestId = requestId,
            StorageKey = $"{accountId}/maintenancerequests/2026/{Guid.NewGuid()}.jpg",
            ThumbnailStorageKey = $"{accountId}/maintenancerequests/2026/thumbnails/{Guid.NewGuid()}.jpg",
            OriginalFileName = "photo.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            DisplayOrder = displayOrder,
            IsPrimary = isPrimary,
            CreatedByUserId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupMaintenanceRequestsDbSet(List<MaintenanceRequest> requests)
    {
        var filtered = requests
            .Where(r => r.AccountId == _testAccountId && r.DeletedAt == null)
            .ToList();
        var mockDbSet = filtered.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
    }

    private void SetupMaintenanceRequestPhotosDbSet(List<MaintenanceRequestPhoto> photos)
    {
        var mockDbSet = photos.BuildMockDbSet();
        _dbContextMock.Setup(x => x.MaintenanceRequestPhotos).Returns(mockDbSet.Object);
    }
}
