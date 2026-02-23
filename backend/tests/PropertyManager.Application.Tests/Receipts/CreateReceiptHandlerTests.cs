using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Receipts;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Receipts;

/// <summary>
/// Unit tests for CreateReceiptHandler (AC-5.1.3).
/// </summary>
public class CreateReceiptHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<IReceiptNotificationService> _notificationServiceMock;
    private readonly Mock<IReceiptThumbnailService> _thumbnailServiceMock;
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly CreateReceiptHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly List<Receipt> _receipts = new();

    public CreateReceiptHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _notificationServiceMock = new Mock<IReceiptNotificationService>();
        _thumbnailServiceMock = new Mock<IReceiptThumbnailService>();
        _storageServiceMock = new Mock<IStorageService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        // Setup receipts DbSet for Add operations
        var mockReceiptsDbSet = _receipts.AsQueryable().BuildMockDbSet();
        mockReceiptsDbSet.Setup(x => x.Add(It.IsAny<Receipt>()))
            .Callback<Receipt>(r =>
            {
                // Simulate EF Core generating an ID on Add
                r.Id = Guid.NewGuid();
                _receipts.Add(r);
            });
        _dbContextMock.Setup(x => x.Receipts).Returns(mockReceiptsDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        // Default: thumbnail generation succeeds
        _thumbnailServiceMock.Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string storageKey, string _, CancellationToken _) =>
            {
                var thumbKey = StorageKeyToThumbnailKey(storageKey);
                return thumbKey;
            });

        // Default: presigned URL generation succeeds
        _storageServiceMock.Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string key, CancellationToken _) => $"https://s3.example.com/{key}");

        _handler = new CreateReceiptHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _notificationServiceMock.Object,
            _thumbnailServiceMock.Object,
            _storageServiceMock.Object,
            Mock.Of<ILogger<CreateReceiptHandler>>());
    }

    [Fact]
    public async Task Handle_ValidRequestWithoutPropertyId_CreatesReceipt()
    {
        // Arrange
        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeEmpty();
        _dbContextMock.Verify(x => x.Receipts.Add(It.Is<Receipt>(r =>
            r.StorageKey == command.StorageKey &&
            r.OriginalFileName == command.OriginalFileName &&
            r.ContentType == command.ContentType &&
            r.FileSizeBytes == command.FileSizeBytes &&
            r.AccountId == _testAccountId &&
            r.CreatedByUserId == _testUserId &&
            r.PropertyId == null)), Times.Once);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);

        // Verify SignalR notification was sent with presigned URLs (AC-5.6.1, AC-16.9.1)
        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.PropertyId == null &&
                e.PropertyName == null &&
                e.ViewUrl != null &&
                e.ThumbnailUrl != null &&
                e.ContentType == "image/jpeg"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidRequestWithPropertyId_CreatesReceipt()
    {
        // Arrange
        SetupPropertiesDbSet(new List<Property>
        {
            new Property
            {
                Id = _testPropertyId,
                AccountId = _testAccountId,
                Name = "Test Property",
                Street = "123 Test St",
                City = "Austin",
                State = "TX",
                ZipCode = "78701"
            }
        });

        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: _testPropertyId);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeEmpty();
        _dbContextMock.Verify(x => x.Receipts.Add(It.Is<Receipt>(r =>
            r.PropertyId == _testPropertyId)), Times.Once);

        // Verify SignalR notification was sent with property info and presigned URLs (AC-5.6.1, AC-16.9.1)
        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.PropertyId == _testPropertyId &&
                e.PropertyName == "Test Property" &&
                e.ViewUrl != null &&
                e.ThumbnailUrl != null &&
                e.ContentType == "image/jpeg"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupPropertiesDbSet(new List<Property>());

        var nonExistentPropertyId = Guid.NewGuid();
        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: nonExistentPropertyId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentPropertyId}*");
    }

    [Fact]
    public async Task Handle_SetsCorrectAccountId()
    {
        // Arrange
        Receipt? addedReceipt = null;
        _dbContextMock.Setup(x => x.Receipts.Add(It.IsAny<Receipt>()))
            .Callback<Receipt>(r => addedReceipt = r);

        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedReceipt.Should().NotBeNull();
        addedReceipt!.AccountId.Should().Be(_testAccountId);
    }

    [Fact]
    public async Task Handle_SetsCorrectCreatedByUserId()
    {
        // Arrange
        Receipt? addedReceipt = null;
        _dbContextMock.Setup(x => x.Receipts.Add(It.IsAny<Receipt>()))
            .Callback<Receipt>(r => addedReceipt = r);

        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedReceipt.Should().NotBeNull();
        addedReceipt!.CreatedByUserId.Should().Be(_testUserId);
    }

    [Fact]
    public async Task Handle_ImageReceipt_GeneratesThumbnailAndSetsThumbnailStorageKey()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/2025/test-guid.jpg";
        var expectedThumbKey = StorageKeyToThumbnailKey(storageKey);

        var command = new CreateReceiptCommand(
            StorageKey: storageKey,
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _thumbnailServiceMock.Verify(x => x.GenerateThumbnailAsync(
            storageKey, "image/jpeg", It.IsAny<CancellationToken>()), Times.Once);

        var addedReceipt = _receipts.Single();
        addedReceipt.ThumbnailStorageKey.Should().Be(expectedThumbKey);
    }

    [Fact]
    public async Task Handle_PdfReceipt_GeneratesThumbnailAndSetsThumbnailStorageKey()
    {
        // Arrange
        var storageKey = $"{_testAccountId}/2025/test-guid.pdf";
        var expectedThumbKey = StorageKeyToThumbnailKey(storageKey);

        var command = new CreateReceiptCommand(
            StorageKey: storageKey,
            OriginalFileName: "receipt.pdf",
            ContentType: "application/pdf",
            FileSizeBytes: 2 * 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _thumbnailServiceMock.Verify(x => x.GenerateThumbnailAsync(
            storageKey, "application/pdf", It.IsAny<CancellationToken>()), Times.Once);

        var addedReceipt = _receipts.Single();
        addedReceipt.ThumbnailStorageKey.Should().Be(expectedThumbKey);
    }

    [Fact]
    public async Task Handle_ThumbnailGenerationFails_StillCreatesReceipt()
    {
        // Arrange - thumbnail service returns null (failure)
        _thumbnailServiceMock.Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert - receipt should still be created
        result.Should().NotBeEmpty();
        _dbContextMock.Verify(x => x.Receipts.Add(It.IsAny<Receipt>()), Times.Once);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);

        var addedReceipt = _receipts.Single();
        addedReceipt.ThumbnailStorageKey.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ThumbnailGenerationThrows_StillCreatesReceipt()
    {
        // Arrange - thumbnail service throws
        _thumbnailServiceMock.Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("PDF rendering failed"));

        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.pdf",
            OriginalFileName: "receipt.pdf",
            ContentType: "application/pdf",
            FileSizeBytes: 2 * 1024 * 1024,
            PropertyId: null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert - receipt should still be created without thumbnail
        result.Should().NotBeEmpty();
        _dbContextMock.Verify(x => x.Receipts.Add(It.IsAny<Receipt>()), Times.Once);

        var addedReceipt = _receipts.Single();
        addedReceipt.ThumbnailStorageKey.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WithThumbnail_SavesChangesAgainToUpdateThumbnailKey()
    {
        // Arrange
        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - SaveChangesAsync called at least twice: once for receipt creation, once for thumbnail update
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_WithThumbnail_IncludesPresignedUrlsInNotification()
    {
        // Arrange (AC-16.9.1, AC-16.9.3)
        var storageKey = $"{_testAccountId}/2025/test-guid.jpg";
        var expectedThumbKey = StorageKeyToThumbnailKey(storageKey);

        var command = new CreateReceiptCommand(
            StorageKey: storageKey,
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - both presigned URLs should be generated and passed to notification
        _storageServiceMock.Verify(x => x.GeneratePresignedDownloadUrlAsync(
            storageKey, It.IsAny<CancellationToken>()), Times.Once);
        _storageServiceMock.Verify(x => x.GeneratePresignedDownloadUrlAsync(
            expectedThumbKey, It.IsAny<CancellationToken>()), Times.Once);

        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.ViewUrl == $"https://s3.example.com/{storageKey}" &&
                e.ThumbnailUrl == $"https://s3.example.com/{expectedThumbKey}" &&
                e.ContentType == "image/jpeg"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ThumbnailGenerationFails_IncludesViewUrlOnly()
    {
        // Arrange (AC-16.9.1) - thumbnail generation returns null
        var storageKey = $"{_testAccountId}/2025/test-guid.jpg";
        _thumbnailServiceMock.Setup(x => x.GenerateThumbnailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var command = new CreateReceiptCommand(
            StorageKey: storageKey,
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - ViewUrl present, ThumbnailUrl null (no thumbnail key to generate URL for)
        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.ViewUrl == $"https://s3.example.com/{storageKey}" &&
                e.ThumbnailUrl == null &&
                e.ContentType == "image/jpeg"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PresignedUrlGenerationThrows_StillSendsNotificationWithNullUrls()
    {
        // Arrange - storage service throws on URL generation
        _storageServiceMock.Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("S3 unavailable"));

        var command = new CreateReceiptCommand(
            StorageKey: $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName: "receipt.jpg",
            ContentType: "image/jpeg",
            FileSizeBytes: 1024 * 1024,
            PropertyId: null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert - receipt created, notification sent with null URLs
        result.Should().NotBeEmpty();
        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.ViewUrl == null &&
                e.ThumbnailUrl == null &&
                e.ContentType == "image/jpeg"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private static string StorageKeyToThumbnailKey(string storageKey)
    {
        var lastDot = storageKey.LastIndexOf('.');
        return lastDot >= 0
            ? $"{storageKey[..lastDot]}_thumb.jpg"
            : $"{storageKey}_thumb.jpg";
    }
}
