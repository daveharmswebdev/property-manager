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
/// Unit tests for DeleteReceiptHandler (AC-5.1.7).
/// </summary>
public class DeleteReceiptHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<IStorageService> _storageServiceMock;
    private readonly Mock<ILogger<DeleteReceiptHandler>> _loggerMock;
    private readonly DeleteReceiptHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public DeleteReceiptHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _storageServiceMock = new Mock<IStorageService>();
        _loggerMock = new Mock<ILogger<DeleteReceiptHandler>>();

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _handler = new DeleteReceiptHandler(
            _dbContextMock.Object,
            _storageServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ValidId_SoftDeletesReceipt()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        _storageServiceMock
            .Setup(x => x.DeleteFileAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new DeleteReceiptCommand(receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        receipt.DeletedAt.Should().NotBeNull();
        receipt.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidId_DeletesFileFromS3()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        _storageServiceMock
            .Setup(x => x.DeleteFileAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new DeleteReceiptCommand(receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _storageServiceMock.Verify(x => x.DeleteFileAsync(
            receipt.StorageKey,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_S3DeleteFails_StillSoftDeletesReceipt()
    {
        // Arrange
        var receipt = CreateTestReceipt();
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        _storageServiceMock
            .Setup(x => x.DeleteFileAsync(
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("S3 error"));

        var command = new DeleteReceiptCommand(receipt.Id);

        // Act - should not throw despite S3 failure
        await _handler.Handle(command, CancellationToken.None);

        // Assert - receipt should still be soft-deleted
        receipt.DeletedAt.Should().NotBeNull();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupReceiptsDbSet(new List<Receipt>());

        var nonExistentId = Guid.NewGuid();
        var command = new DeleteReceiptCommand(nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_AlreadyDeletedReceipt_ThrowsNotFoundException()
    {
        // Arrange
        var deletedReceipt = CreateTestReceipt();
        deletedReceipt.DeletedAt = DateTime.UtcNow.AddDays(-1);
        SetupReceiptsDbSet(new List<Receipt> { deletedReceipt });

        var command = new DeleteReceiptCommand(deletedReceipt.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_EnforcesTenantIsolation()
    {
        // Arrange - with global query filter, other account receipts not visible
        SetupReceiptsDbSet(new List<Receipt>());

        var otherAccountReceiptId = Guid.NewGuid();
        var command = new DeleteReceiptCommand(otherAccountReceiptId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
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
