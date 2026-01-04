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
/// Unit tests for UnlinkReceiptHandler (AC-5.5.5).
/// </summary>
public class UnlinkReceiptHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ILogger<UnlinkReceiptHandler>> _loggerMock;
    private readonly UnlinkReceiptHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();

    public UnlinkReceiptHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _loggerMock = new Mock<ILogger<UnlinkReceiptHandler>>();

        _handler = new UnlinkReceiptHandler(_dbContextMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ExpenseNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupExpensesDbSet(new List<Expense>());
        SetupReceiptsDbSet(new List<Receipt>());

        var nonExistentId = Guid.NewGuid();
        var command = new UnlinkReceiptCommand(nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Expense*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_NoReceiptLinked_ThrowsNotFoundException()
    {
        // Arrange
        var expense = CreateExpense();
        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt>()); // No receipt linked

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Receipt for expense*");
    }

    [Fact]
    public async Task Handle_ValidCommand_UnlinksReceiptFromExpense()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateReceipt(expense.Id);
        receipt.ExpenseId.Should().Be(expense.Id); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        receipt.ExpenseId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ValidCommand_ClearsProcessedAtTimestamp()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateReceipt(expense.Id);
        receipt.ProcessedAt = DateTime.UtcNow.AddHours(-1);
        receipt.ProcessedAt.Should().NotBeNull(); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - ProcessedAt is cleared to return receipt to unprocessed queue
        receipt.ProcessedAt.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsSaveChanges()
    {
        // Arrange
        var expense = CreateExpense();
        var receipt = CreateReceipt(expense.Id);
        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReceiptLinkedToDifferentExpense_ThrowsNotFoundException()
    {
        // Arrange
        var expense = CreateExpense();
        var differentExpenseId = Guid.NewGuid();
        var receipt = CreateReceipt(differentExpenseId); // Linked to different expense

        SetupExpensesDbSet(new List<Expense> { expense });
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Receipt for expense*");
    }

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

    private Receipt CreateReceipt(Guid? expenseId)
    {
        return new Receipt
        {
            Id = Guid.NewGuid(),
            AccountId = _testAccountId,
            PropertyId = _testPropertyId,
            ExpenseId = expenseId,
            StorageKey = "receipts/test-key.jpg",
            ContentType = "image/jpeg",
            OriginalFileName = "receipt.jpg",
            FileSizeBytes = 12345,
            CreatedByUserId = _testUserId,
            ProcessedAt = expenseId.HasValue ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
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
