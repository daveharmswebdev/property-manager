using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for SetPrimaryWorkOrderPhotoHandler (Story 10-6).
/// Tests setting a photo as primary and clearing previous primary.
/// </summary>
public class SetPrimaryWorkOrderPhotoHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<DatabaseFacade> _databaseMock;
    private readonly Mock<IDbContextTransaction> _transactionMock;
    private readonly SetPrimaryWorkOrderPhotoHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testWorkOrderId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public SetPrimaryWorkOrderPhotoHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        // Setup transaction mock
        _transactionMock = new Mock<IDbContextTransaction>();
        _transactionMock.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _transactionMock.Setup(x => x.RollbackAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _transactionMock.Setup(x => x.DisposeAsync())
            .Returns(ValueTask.CompletedTask);

        // Setup database facade mock - need to use a real DbContext for the mock
        // We'll use a workaround by creating a mock that returns the transaction
        _databaseMock = new Mock<DatabaseFacade>(Mock.Of<DbContext>());
        _databaseMock.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(_transactionMock.Object);

        _dbContextMock.Setup(x => x.Database).Returns(_databaseMock.Object);

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new SetPrimaryWorkOrderPhotoHandler(
            _dbContextMock.Object,
            _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidRequest_SetsPhotoAsPrimary()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, _testAccountId, _testWorkOrderId, isPrimary: false);
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, photoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        _transactionMock.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PhotoAlreadyPrimary_DoesNothing()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, _testAccountId, _testWorkOrderId, isPrimary: true);
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, photoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        // No transaction started for no-op
        _databaseMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ClearsPreviousPrimaryPhoto()
    {
        // Arrange
        var newPrimaryId = Guid.NewGuid();
        var oldPrimaryId = Guid.NewGuid();
        var newPrimary = CreatePhoto(newPrimaryId, _testAccountId, _testWorkOrderId, isPrimary: false);
        var oldPrimary = CreatePhoto(oldPrimaryId, _testAccountId, _testWorkOrderId, isPrimary: true);

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { newPrimary, oldPrimary });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, newPrimaryId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        newPrimary.IsPrimary.Should().BeTrue();
        oldPrimary.IsPrimary.Should().BeFalse();
        // SaveChanges called twice: once to clear old, once to set new
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Handle_PhotoNotFound_ThrowsNotFoundException()
    {
        // Arrange
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto>());

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, Guid.NewGuid());

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentWorkOrder_ThrowsNotFoundException()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, _testAccountId, Guid.NewGuid(), isPrimary: false); // Different work order
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, photoId);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_PhotoBelongsToDifferentAccount_ThrowsNotFoundException()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, Guid.NewGuid(), _testWorkOrderId, isPrimary: false); // Different account
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, photoId);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_MultiplePhotos_OnlyNewPrimaryIsSet()
    {
        // Arrange
        var photo1Id = Guid.NewGuid();
        var photo2Id = Guid.NewGuid();
        var photo3Id = Guid.NewGuid();
        var photo1 = CreatePhoto(photo1Id, _testAccountId, _testWorkOrderId, isPrimary: true);
        var photo2 = CreatePhoto(photo2Id, _testAccountId, _testWorkOrderId, isPrimary: false);
        var photo3 = CreatePhoto(photo3Id, _testAccountId, _testWorkOrderId, isPrimary: false);

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo1, photo2, photo3 });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, photo2Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo1.IsPrimary.Should().BeFalse();
        photo2.IsPrimary.Should().BeTrue();
        photo3.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_NoPreviousPrimary_SetsNewPrimaryWithoutError()
    {
        // Arrange
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(photoId, _testAccountId, _testWorkOrderId, isPrimary: false);
        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { photo });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, photoId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        photo.IsPrimary.Should().BeTrue();
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_UsesTransactionForAtomicity()
    {
        // Arrange
        var newPrimaryId = Guid.NewGuid();
        var oldPrimaryId = Guid.NewGuid();
        var newPrimary = CreatePhoto(newPrimaryId, _testAccountId, _testWorkOrderId, isPrimary: false);
        var oldPrimary = CreatePhoto(oldPrimaryId, _testAccountId, _testWorkOrderId, isPrimary: true);

        SetupWorkOrderPhotosDbSet(new List<WorkOrderPhoto> { newPrimary, oldPrimary });

        var command = new SetPrimaryWorkOrderPhotoCommand(_testWorkOrderId, newPrimaryId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - verify transaction was used
        _databaseMock.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _transactionMock.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
        _transactionMock.Verify(x => x.RollbackAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private WorkOrderPhoto CreatePhoto(Guid photoId, Guid accountId, Guid workOrderId, bool isPrimary)
    {
        return new WorkOrderPhoto
        {
            Id = photoId,
            AccountId = accountId,
            WorkOrderId = workOrderId,
            StorageKey = $"{accountId}/workorders/2026/photo-{photoId}.jpg",
            OriginalFileName = $"photo-{photoId}.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 1024,
            DisplayOrder = 0,
            IsPrimary = isPrimary,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private void SetupWorkOrderPhotosDbSet(List<WorkOrderPhoto> photos)
    {
        var mockDbSet = photos.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderPhotos).Returns(mockDbSet.Object);
    }
}
