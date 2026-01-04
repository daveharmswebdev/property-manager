using FluentAssertions;
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
    private readonly CreateReceiptHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();

    public CreateReceiptHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _notificationServiceMock = new Mock<IReceiptNotificationService>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);

        // Setup receipts DbSet for Add operations
        var receipts = new List<Receipt>();
        var mockReceiptsDbSet = receipts.AsQueryable().BuildMockDbSet();
        mockReceiptsDbSet.Setup(x => x.Add(It.IsAny<Receipt>()))
            .Callback<Receipt>(r =>
            {
                // Simulate EF Core generating an ID on Add
                r.Id = Guid.NewGuid();
                receipts.Add(r);
            });
        _dbContextMock.Setup(x => x.Receipts).Returns(mockReceiptsDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _handler = new CreateReceiptHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _notificationServiceMock.Object);
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
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Verify SignalR notification was sent (AC-5.6.1)
        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.PropertyId == null &&
                e.PropertyName == null),
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

        // Verify SignalR notification was sent with property info (AC-5.6.1)
        _notificationServiceMock.Verify(x => x.NotifyReceiptAddedAsync(
            _testAccountId,
            It.Is<ReceiptAddedEvent>(e =>
                e.PropertyId == _testPropertyId &&
                e.PropertyName == "Test Property"),
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

    private void SetupPropertiesDbSet(List<Property> properties)
    {
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }
}
