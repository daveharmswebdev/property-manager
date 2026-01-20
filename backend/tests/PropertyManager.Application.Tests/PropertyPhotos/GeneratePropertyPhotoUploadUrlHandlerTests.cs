using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.PropertyPhotos;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.PropertyPhotos;

/// <summary>
/// Unit tests for GeneratePropertyPhotoUploadUrlHandler (AC-13.3a.3).
/// Tests presigned URL generation for property photo uploads.
/// </summary>
public class GeneratePropertyPhotoUploadUrlHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IPhotoService> _photoServiceMock;
    private readonly GeneratePropertyPhotoUploadUrlHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public GeneratePropertyPhotoUploadUrlHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _photoServiceMock = new Mock<IPhotoService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GeneratePropertyPhotoUploadUrlHandler(
            _photoServiceMock.Object,
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReturnsUploadUrlDetails()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        var expectedStorageKey = $"{_testAccountId}/properties/2026/test.jpg";
        var expectedThumbnailKey = $"{_testAccountId}/properties/2026/thumbnails/test.jpg";
        var expectedUploadUrl = "https://s3.amazonaws.com/bucket/presigned-url";
        var expectedExpiresAt = DateTime.UtcNow.AddMinutes(15);

        SetupPropertiesDbSet(new List<Property> { property });
        SetupPhotoServiceMock(expectedUploadUrl, expectedStorageKey, expectedThumbnailKey, expectedExpiresAt);

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            _testPropertyId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().Be(expectedUploadUrl);
        result.StorageKey.Should().Be(expectedStorageKey);
        result.ThumbnailStorageKey.Should().Be(expectedThumbnailKey);
        result.ExpiresAt.Should().Be(expectedExpiresAt);
    }

    [Fact]
    public async Task Handle_ValidRequest_CallsPhotoServiceWithCorrectParameters()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        SetupPropertiesDbSet(new List<Property> { property });
        SetupPhotoServiceMock();

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            _testPropertyId,
            "image/png",
            2048,
            "screenshot.png");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.Is<PhotoUploadRequest>(r =>
                r.EntityType == PhotoEntityType.Properties &&
                r.EntityId == _testPropertyId &&
                r.ContentType == "image/png" &&
                r.FileSizeBytes == 2048 &&
                r.OriginalFileName == "screenshot.png"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupPropertiesDbSet(new List<Property>()); // No properties

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            Guid.NewGuid(),
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PropertyBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var otherAccountId = Guid.NewGuid();
        var property = new Property
        {
            Id = _testPropertyId,
            AccountId = otherAccountId, // Different account
            Name = "Other Property",
            Street = "123 Other St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        SetupPropertiesDbSet(new List<Property> { property });

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            _testPropertyId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_UsesCorrectEntityType()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        SetupPropertiesDbSet(new List<Property> { property });
        SetupPhotoServiceMock();

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            _testPropertyId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Verify PhotoEntityType.Properties is used
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            It.IsAny<Guid>(),
            It.Is<PhotoUploadRequest>(r => r.EntityType == PhotoEntityType.Properties),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    public async Task Handle_SupportedContentTypes_Succeeds(string contentType)
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        SetupPropertiesDbSet(new List<Property> { property });
        SetupPhotoServiceMock();

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            _testPropertyId,
            contentType,
            1024,
            "test.jpg");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UploadUrl.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Handle_PassesAccountIdToPhotoService()
    {
        // Arrange
        var property = CreateProperty(_testAccountId);
        SetupPropertiesDbSet(new List<Property> { property });
        SetupPhotoServiceMock();

        var command = new GeneratePropertyPhotoUploadUrlCommand(
            _testPropertyId,
            "image/jpeg",
            1024,
            "test.jpg");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Verify correct account ID is passed for tenant isolation
        _photoServiceMock.Verify(x => x.GenerateUploadUrlAsync(
            _testAccountId,
            It.IsAny<PhotoUploadRequest>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private Property CreateProperty(Guid accountId)
    {
        return new Property
        {
            Id = _testPropertyId,
            AccountId = accountId,
            Name = "Test Property",
            Street = "123 Test Street",
            City = "Austin",
            State = "TX",
            ZipCode = "78701",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private void SetupPhotoServiceMock(
        string uploadUrl = "https://s3.amazonaws.com/bucket/presigned-url",
        string storageKey = "account/properties/2026/test.jpg",
        string thumbnailKey = "account/properties/2026/thumbnails/test.jpg",
        DateTime? expiresAt = null)
    {
        var expires = expiresAt ?? DateTime.UtcNow.AddMinutes(15);

        _photoServiceMock.Setup(x => x.GenerateUploadUrlAsync(
                It.IsAny<Guid>(),
                It.IsAny<PhotoUploadRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PhotoUploadResult(
                uploadUrl,
                storageKey,
                thumbnailKey,
                expires));
    }
}
