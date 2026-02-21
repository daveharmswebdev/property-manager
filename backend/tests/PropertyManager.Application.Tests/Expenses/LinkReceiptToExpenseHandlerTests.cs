using FluentAssertions;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for LinkReceiptToExpenseHandler (Story 16.4, AC3).
/// Inverse of UnlinkReceiptHandlerTests — links a receipt TO an existing expense.
/// Tests follow the red-green-refactor cycle: these tests FAIL until
/// LinkReceiptToExpense.cs is implemented.
/// </summary>
public class LinkReceiptToExpenseHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ILogger<LinkReceiptToExpenseHandler>> _loggerMock;
    private readonly LinkReceiptToExpenseHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();

    public LinkReceiptToExpenseHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _loggerMock = new Mock<ILogger<LinkReceiptToExpenseHandler>>();

        _handler = new LinkReceiptToExpenseHandler(_dbContextMock.Object, _loggerMock.Object);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Error Cases
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ExpenseNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupExpensesDbSet(new List<Expense>());
        SetupReceiptsDbSet(new List<Receipt>());

        var nonExistentId = Guid.NewGuid();
        var command = new LinkReceiptToExpenseCommand(nonExistentId, Guid.NewGuid());

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Expense*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_ReceiptNotFound_ThrowsNotFoundException()
    {
        // Arrange — expense exists, receipt does not
        var expense = CreateExpense();
        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt>());

        var nonExistentReceiptId = Guid.NewGuid();
        var command = new LinkReceiptToExpenseCommand(expense.Id, nonExistentReceiptId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Receipt*{nonExistentReceiptId}*");
    }

    [Fact]
    public async Task Handle_ExpenseAlreadyHasReceipt_ThrowsConflictException()
    {
        // Arrange — expense already linked to a different receipt
        var existingReceipt = CreateReceipt(processed: true);
        var expense = CreateExpense();
        expense.ReceiptId = existingReceipt.Id; // Already has a receipt

        var newReceipt = CreateUnprocessedReceipt();

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { newReceipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, newReceipt.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage($"*{expense.Id}*already has a linked receipt*");
    }

    [Fact]
    public async Task Handle_ReceiptAlreadyProcessed_ThrowsConflictException()
    {
        // Arrange — receipt is already processed (linked to another expense)
        var expense = CreateExpense();
        var processedReceipt = CreateReceipt(processed: true);

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { processedReceipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, processedReceipt.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage($"*{processedReceipt.Id}*is already processed*");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Happy Path — Linking Both Sides of 1:1 Relationship
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ValidCommand_SetsExpenseReceiptId()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateUnprocessedReceipt();
        expense.ReceiptId.Should().BeNull(); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert — the real FK is set
        expense.ReceiptId.Should().Be(receipt.Id);
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsReceiptExpenseId()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateUnprocessedReceipt();
        receipt.ExpenseId.Should().BeNull(); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert — the shadow property is set (critical: Story 15.4 lesson)
        receipt.ExpenseId.Should().Be(expense.Id);
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsReceiptProcessedAt()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateUnprocessedReceipt();
        receipt.ProcessedAt.Should().BeNull(); // Precondition: unprocessed

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert — ProcessedAt marks receipt as linked
        receipt.ProcessedAt.Should().NotBeNull();
        receipt.ProcessedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_ReceiptWithNoProperty_SyncsPropertyFromExpense()
    {
        // Arrange — receipt was uploaded without property assignment
        var expense = CreateExpense();
        var receipt = CreateUnprocessedReceipt();
        receipt.PropertyId = null; // No property on receipt

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert — property synced from expense
        receipt.PropertyId.Should().Be(expense.PropertyId);
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsSaveChanges()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateUnprocessedReceipt();

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new LinkReceiptToExpenseCommand(expense.Id, receipt.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private Expense CreateExpense()
    {
        return new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            CategoryId = _testCategoryId,
            Amount = 100.00m,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Description = "Test expense",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        };
    }

    private Receipt CreateReceipt(bool processed = false)
    {
        return new Receipt
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            StorageKey = "receipts/test-key.jpg",
            ContentType = "image/jpeg",
            OriginalFileName = "receipt.jpg",
            FileSizeBytes = 12345,
            CreatedByUserId = _testUserId,
            ProcessedAt = processed ? DateTime.UtcNow.AddHours(-1) : null,
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
    }

    private Receipt CreateUnprocessedReceipt()
    {
        return CreateReceipt(processed: false);
    }

    private void SetupExpensesDbSet(List<Expense> expenses)
    {
        var mockDbSet = expenses.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Expenses).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }

    private void SetupReceiptsDbSet(List<Receipt> receipts)
    {
        var mockDbSet = receipts.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Receipts).Returns(mockDbSet.Object);
    }
}
