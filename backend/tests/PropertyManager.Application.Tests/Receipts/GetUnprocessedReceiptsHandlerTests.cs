using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Receipts;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Receipts;

/// <summary>
/// Unit tests for GetUnprocessedReceiptsHandler (AC-5.3.2, AC-5.3.4).
/// </summary>
public class GetUnprocessedReceiptsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly GetUnprocessedReceiptsHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GetUnprocessedReceiptsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _storageServiceMock = new Mock<IStorageService>();

        _handler = new GetUnprocessedReceiptsHandler(
            _dbContextMock.Object,
            _storageServiceMock.Object);
    }

    [Fact]
    public async Task Handle_ReturnsOnlyUnprocessedReceipts()
    {
        // Arrange
        var unprocessedReceipt = CreateTestReceipt(processedAt: null);
        var processedReceipt = CreateTestReceipt(processedAt: DateTime.UtcNow);

        SetupReceiptsDbSet(new List<Receipt> { unprocessedReceipt, processedReceipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(unprocessedReceipt.Id);
        result.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task Handle_SortsByCreatedAtDescending()
    {
        // Arrange
        var oldestReceipt = CreateTestReceipt(createdAt: DateTime.UtcNow.AddDays(-3));
        var newestReceipt = CreateTestReceipt(createdAt: DateTime.UtcNow);
        var middleReceipt = CreateTestReceipt(createdAt: DateTime.UtcNow.AddDays(-1));

        SetupReceiptsDbSet(new List<Receipt> { oldestReceipt, newestReceipt, middleReceipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(3);
        result.Items[0].Id.Should().Be(newestReceipt.Id, "newest should be first");
        result.Items[1].Id.Should().Be(middleReceipt.Id, "middle should be second");
        result.Items[2].Id.Should().Be(oldestReceipt.Id, "oldest should be last");
    }

    [Fact]
    public async Task Handle_IncludesPropertyNameWhenAssigned()
    {
        // Arrange
        var property = new Property
        {
            Id = Guid.NewGuid(),
            Name = "Oak Street Duplex",
            Street = "123 Oak St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701",
            AccountId = _testAccountId
        };

        var receipt = CreateTestReceipt();
        receipt.PropertyId = property.Id;
        receipt.Property = property;

        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].PropertyId.Should().Be(property.Id);
        result.Items[0].PropertyName.Should().Be("Oak Street Duplex");
    }

    [Fact]
    public async Task Handle_ReturnsNullPropertyNameForUnassigned()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        receipt.PropertyId = null;
        receipt.Property = null;

        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].PropertyId.Should().BeNull();
        result.Items[0].PropertyName.Should().BeNull();
    }

    [Fact]
    public async Task Handle_GeneratesPresignedUrlForEachReceipt()
    {
        // Arrange
        var receipt1 = CreateTestReceipt();
        receipt1.StorageKey = "account/2025/receipt1.jpg";
        var receipt2 = CreateTestReceipt();
        receipt2.StorageKey = "account/2025/receipt2.jpg";

        SetupReceiptsDbSet(new List<Receipt> { receipt1, receipt2 });

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                "account/2025/receipt1.jpg",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/presigned-url-1");

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                "account/2025/receipt2.jpg",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/presigned-url-2");

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().Contain(x => x.ViewUrl == "https://bucket.s3.amazonaws.com/presigned-url-1");
        result.Items.Should().Contain(x => x.ViewUrl == "https://bucket.s3.amazonaws.com/presigned-url-2");

        _storageServiceMock.Verify(x => x.GeneratePresignedDownloadUrlAsync(
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_ReturnsEmptyListWhenNoUnprocessedReceipts()
    {
        // Arrange
        var processedReceipt = CreateTestReceipt(processedAt: DateTime.UtcNow);

        SetupReceiptsDbSet(new List<Receipt> { processedReceipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_ExcludesDeletedReceipts()
    {
        // Arrange
        var activeReceipt = CreateTestReceipt();
        var deletedReceipt = CreateTestReceipt();
        deletedReceipt.DeletedAt = DateTime.UtcNow;

        SetupReceiptsDbSet(new List<Receipt> { activeReceipt, deletedReceipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(activeReceipt.Id);
    }

    [Fact]
    public async Task Handle_ReturnsCorrectContentType()
    {
        // Arrange
        var jpegReceipt = CreateTestReceipt();
        jpegReceipt.ContentType = "image/jpeg";

        var pdfReceipt = CreateTestReceipt();
        pdfReceipt.ContentType = "application/pdf";

        SetupReceiptsDbSet(new List<Receipt> { jpegReceipt, pdfReceipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().Contain(x => x.ContentType == "image/jpeg");
        result.Items.Should().Contain(x => x.ContentType == "application/pdf");
    }

    [Fact]
    public async Task Handle_ReturnsDefaultContentTypeWhenNull()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        receipt.ContentType = null;

        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].ContentType.Should().Be("application/octet-stream");
    }

    [Fact]
    public async Task Handle_ReceiptWithThumbnail_ReturnsThumbnailUrl()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        receipt.ThumbnailStorageKey = "account/2025/receipt1_thumb.jpg";

        SetupReceiptsDbSet(new List<Receipt> { receipt });

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                receipt.StorageKey,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/view-url");

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                "account/2025/receipt1_thumb.jpg",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/thumb-url");

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].ThumbnailUrl.Should().Be("https://bucket.s3.amazonaws.com/thumb-url");
        result.Items[0].ViewUrl.Should().Be("https://bucket.s3.amazonaws.com/view-url");
    }

    [Fact]
    public async Task Handle_ReceiptWithoutThumbnail_ReturnsNullThumbnailUrl()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        receipt.ThumbnailStorageKey = null;

        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupStorageService();

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].ThumbnailUrl.Should().BeNull();
    }

    [Fact]
    public async Task Handle_MixedReceipts_GeneratesThumbnailUrlsOnlyForThoseWithThumbnails()
    {
        // Arrange
        var receiptWithThumb = CreateTestReceipt();
        receiptWithThumb.StorageKey = "account/2025/with-thumb.jpg";
        receiptWithThumb.ThumbnailStorageKey = "account/2025/with-thumb_thumb.jpg";

        var receiptWithoutThumb = CreateTestReceipt();
        receiptWithoutThumb.StorageKey = "account/2025/no-thumb.pdf";
        receiptWithoutThumb.ThumbnailStorageKey = null;

        SetupReceiptsDbSet(new List<Receipt> { receiptWithThumb, receiptWithoutThumb });

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.Is<string>(k => !k.Contains("_thumb")),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/view");

        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                "account/2025/with-thumb_thumb.jpg",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/thumb");

        var query = new GetUnprocessedReceiptsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        var withThumb = result.Items.First(x => x.ViewUrl.Contains("view"));
        var withoutThumb = result.Items.Last();

        // Only generate presigned URL for the receipt that has a thumbnail key
        _storageServiceMock.Verify(x => x.GeneratePresignedDownloadUrlAsync(
            "account/2025/with-thumb_thumb.jpg",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private Receipt CreateTestReceipt(DateTime? processedAt = null, DateTime? createdAt = null)
    {
        return new Receipt
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            StorageKey = $"{_testAccountId}/2025/{Guid.NewGuid()}.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024,
            PropertyId = null,
            Property = null,
            ExpenseId = null,
            CreatedByUserId = _testUserId,
            CreatedAt = createdAt ?? DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            ProcessedAt = processedAt,
            DeletedAt = null
        };
    }

    private void SetupReceiptsDbSet(List<Receipt> receipts)
    {
        // Filter to simulate global query filter (soft delete)
        var filteredReceipts = receipts
            .Where(r => r.DeletedAt == null)
            .ToList();

        var mockDbSet = filteredReceipts.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Receipts).Returns(mockDbSet.Object);
    }

    private void SetupStorageService()
    {
        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://bucket.s3.amazonaws.com/presigned-url");
    }
}
