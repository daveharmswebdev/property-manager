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
/// Unit tests for UnlinkReceiptHandler.
/// Tests use Include-based approach: Receipt is accessed via Expense.Receipt navigation property.
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
        // Arrange - expense exists but Receipt navigation is null, ReceiptId is null
        var expense = CreateExpense();
        SetupExpensesDbSet(new List<Expense> { expense });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Receipt for expense*");
    }

    [Fact]
    public async Task Handle_ValidCommand_ClearsExpenseReceiptId()
    {
        // Arrange
        var receipt = CreateReceipt();
        var expense = CreateExpense(receipt);
        expense.ReceiptId.Should().Be(receipt.Id); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - the real FK is cleared
        expense.ReceiptId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ValidCommand_ClearsReceiptExpenseId()
    {
        // Arrange
        var receipt = CreateReceipt();
        var expense = CreateExpense(receipt);
        receipt.ExpenseId.Should().Be(expense.Id); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - the shadow property is cleared
        receipt.ExpenseId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ValidCommand_ClearsProcessedAtTimestamp()
    {
        // Arrange
        var receipt = CreateReceipt();
        var expense = CreateExpense(receipt);
        receipt.ProcessedAt = DateTime.UtcNow.AddHours(-1);
        receipt.ProcessedAt.Should().NotBeNull(); // Precondition

        SetupExpensesDbSet(new List<Expense> { expense });

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
        var receipt = CreateReceipt();
        var expense = CreateExpense(receipt);
        SetupExpensesDbSet(new List<Expense> { expense });

        var command = new UnlinkReceiptCommand(expense.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private Expense CreateExpense(Receipt? receipt = null)
    {
        var expense = new Expense
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

        if (receipt != null)
        {
            expense.ReceiptId = receipt.Id;
            expense.Receipt = receipt;
            receipt.ExpenseId = expense.Id;
        }

        return expense;
    }

    private Receipt CreateReceipt()
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
            ProcessedAt = DateTime.UtcNow,
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
}
