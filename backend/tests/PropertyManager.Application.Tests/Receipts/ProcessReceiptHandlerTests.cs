using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Receipts;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Receipts;

/// <summary>
/// Unit tests for ProcessReceiptHandler (AC-5.4.4).
/// </summary>
public class ProcessReceiptHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly ProcessReceiptHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly Guid _testReceiptId = Guid.NewGuid();
    private readonly Guid _testCategoryId = Guid.NewGuid();

    public ProcessReceiptHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _handler = new ProcessReceiptHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_CreatesExpenseAndMarksReceiptProcessed()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: false);
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupPropertiesDbSet(new List<Property> { CreateTestProperty() });
        SetupExpenseCategoriesDbSet(new List<ExpenseCategory> { CreateTestCategory() });
        SetupExpensesDbSet(new List<Expense>());

        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "Test expense from receipt");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeEmpty();
        _dbContextMock.Verify(x => x.Expenses.Add(It.Is<Expense>(e =>
            e.AccountId == _testAccountId &&
            e.PropertyId == _testPropertyId &&
            e.Amount == 99.99m &&
            e.CategoryId == _testCategoryId &&
            e.ReceiptId == _testReceiptId &&
            e.Description == "Test expense from receipt")), Times.Once);
        receipt.ProcessedAt.Should().NotBeNull();
        receipt.PropertyId.Should().Be(_testPropertyId);
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReceiptNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupReceiptsDbSet(new List<Receipt>());

        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{_testReceiptId}*");
    }

    [Fact]
    public async Task Handle_ReceiptAlreadyProcessed_ThrowsConflictException()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: true);
        SetupReceiptsDbSet(new List<Receipt> { receipt });

        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage($"*{_testReceiptId}*already processed*");
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: false);
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupPropertiesDbSet(new List<Property>());

        var nonExistentPropertyId = Guid.NewGuid();
        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: nonExistentPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentPropertyId}*");
    }

    [Fact]
    public async Task Handle_CategoryNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: false);
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupPropertiesDbSet(new List<Property> { CreateTestProperty() });
        SetupExpenseCategoriesDbSet(new List<ExpenseCategory>());

        var nonExistentCategoryId = Guid.NewGuid();
        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: nonExistentCategoryId,
            Description: null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentCategoryId}*");
    }

    [Fact]
    public async Task Handle_LinksExpenseToReceipt()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: false);
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupPropertiesDbSet(new List<Property> { CreateTestProperty() });
        SetupExpenseCategoriesDbSet(new List<ExpenseCategory> { CreateTestCategory() });

        Expense? addedExpense = null;
        var expenses = new List<Expense>();
        var mockExpensesDbSet = expenses.AsQueryable().BuildMockDbSet();
        mockExpensesDbSet.Setup(x => x.Add(It.IsAny<Expense>()))
            .Callback<Expense>(e =>
            {
                e.Id = Guid.NewGuid();
                addedExpense = e;
                expenses.Add(e);
            });
        _dbContextMock.Setup(x => x.Expenses).Returns(mockExpensesDbSet.Object);

        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedExpense.Should().NotBeNull();
        addedExpense!.ReceiptId.Should().Be(_testReceiptId);
        receipt.ExpenseId.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_TrimsDescription()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: false);
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupPropertiesDbSet(new List<Property> { CreateTestProperty() });
        SetupExpenseCategoriesDbSet(new List<ExpenseCategory> { CreateTestCategory() });
        SetupExpensesDbSet(new List<Expense>());

        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: "  Test description with whitespace  ");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.Expenses.Add(It.Is<Expense>(e =>
            e.Description == "Test description with whitespace")), Times.Once);
    }

    [Fact]
    public async Task Handle_NullDescription_SetsNullOnExpense()
    {
        // Arrange
        var receipt = CreateTestReceipt(processed: false);
        SetupReceiptsDbSet(new List<Receipt> { receipt });
        SetupPropertiesDbSet(new List<Property> { CreateTestProperty() });
        SetupExpenseCategoriesDbSet(new List<ExpenseCategory> { CreateTestCategory() });
        SetupExpensesDbSet(new List<Expense>());

        var command = new ProcessReceiptCommand(
            ReceiptId: _testReceiptId,
            PropertyId: _testPropertyId,
            Amount: 99.99m,
            Date: DateOnly.FromDateTime(DateTime.Today),
            CategoryId: _testCategoryId,
            Description: null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.Expenses.Add(It.Is<Expense>(e =>
            e.Description == null)), Times.Once);
    }

    private Receipt CreateTestReceipt(bool processed)
    {
        return new Receipt
        {
            Id = _testReceiptId,
            AccountId = _testAccountId,
            StorageKey = $"{_testAccountId}/2025/test.jpg",
            OriginalFileName = "test.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            ProcessedAt = processed ? DateTime.UtcNow : null,
            CreatedByUserId = _testUserId
        };
    }

    private Property CreateTestProperty()
    {
        return new Property
        {
            Id = _testPropertyId,
            AccountId = _testAccountId,
            Name = "Test Property",
            Street = "123 Test St",
            City = "Austin",
            State = "TX",
            ZipCode = "78701"
        };
    }

    private ExpenseCategory CreateTestCategory()
    {
        return new ExpenseCategory
        {
            Id = _testCategoryId,
            Name = "Repairs",
            SortOrder = 1
        };
    }

    private void SetupReceiptsDbSet(List<Receipt> receipts)
    {
        var mockDbSet = receipts.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Receipts).Returns(mockDbSet.Object);
    }

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private void SetupExpenseCategoriesDbSet(List<ExpenseCategory> categories)
    {
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }

    private void SetupExpensesDbSet(List<Expense> expenses)
    {
        var mockDbSet = expenses.AsQueryable().BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<Expense>()))
            .Callback<Expense>(e =>
            {
                e.Id = Guid.NewGuid();
                expenses.Add(e);
            });
        _dbContextMock.Setup(x => x.Expenses).Returns(mockDbSet.Object);
    }
}
