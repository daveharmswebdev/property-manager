using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Receipts;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Receipts;

/// <summary>
/// Unit tests for GetReceiptHandler (AC-5.1.4).
/// </summary>
public class GetReceiptHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly GetReceiptHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public GetReceiptHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _storageServiceMock = new Mock<IStorageService>();

        _handler = new GetReceiptHandler(
            _dbContextMock.Object,
            _storageServiceMock.Object);
    }

    [Fact]
    public async Task Handle_ValidId_ReturnsReceiptWithViewUrl()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        var viewUrl = "https://bucket.s3.amazonaws.com/presigned-download-url";

        SetupReceiptsDbSet(new List<Receipt> { receipt });
        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                receipt.StorageKey,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(viewUrl);

        var query = new GetReceiptQuery(receipt.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(receipt.Id);
        result.ViewUrl.Should().Be(viewUrl);
    }

    [Fact]
    public async Task Handle_ValidId_ReturnsAllReceiptDetails()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com");

        var query = new GetReceiptQuery(receipt.Id);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Id.Should().Be(receipt.Id);
        result.OriginalFileName.Should().Be(receipt.OriginalFileName);
        result.ContentType.Should().Be(receipt.ContentType);
        result.FileSizeBytes.Should().Be(receipt.FileSizeBytes!.Value);
        result.PropertyId.Should().Be(receipt.PropertyId);
        result.ExpenseId.Should().Be(receipt.ExpenseId);
        result.CreatedAt.Should().Be(receipt.CreatedAt);
        result.ProcessedAt.Should().Be(receipt.ProcessedAt);
    }

    [Fact]
    public async Task Handle_NotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupReceiptsDbSet(new List<Receipt>());

        var nonExistentId = Guid.NewGuid();
        var query = new GetReceiptQuery(nonExistentId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_DeletedReceipt_ThrowsNotFoundException()
    {
        // Arrange
        var deletedReceipt = CreateTestReceipt();
        deletedReceipt.DeletedAt = DateTime.UtcNow;
        SetupReceiptsDbSet(new List<Receipt> { deletedReceipt });

        var query = new GetReceiptQuery(deletedReceipt.Id);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_EnforcesTenantIsolation()
    {
        // Arrange - with global query filter, other account receipts not visible
        SetupReceiptsDbSet(new List<Receipt>());

        var otherAccountReceiptId = Guid.NewGuid();
        var query = new GetReceiptQuery(otherAccountReceiptId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_CallsStorageServiceForViewUrl()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        _storageServiceMock
            .Setup(x => x.GeneratePresignedDownloadUrlAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://example.com");

        var query = new GetReceiptQuery(receipt.Id);

        // Act
        await _handler.Handle(query, CancellationToken.None);

        // Assert
        _storageServiceMock.Verify(x => x.GeneratePresignedDownloadUrlAsync(
            receipt.StorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private Receipt CreateTestReceipt()
    {
        return new Receipt
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            StorageKey = $"{_testAccountId}/2025/test-guid.jpg",
            OriginalFileName = "receipt.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024 * 1024,
            PropertyId = null,
            ExpenseId = null,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            ProcessedAt = null,
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
}
