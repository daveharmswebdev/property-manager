using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using Microsoft.Extensions.Logging;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Vendors;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for DeleteVendorCommandHandler (AC #3, #5, #6).
/// Tests soft delete behavior.
/// </summary>
public class DeleteVendorHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly Mock<ILogger<DeleteVendorCommandHandler>> _loggerMock;
    private readonly DeleteVendorCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public DeleteVendorHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _loggerMock = new Mock<ILogger<DeleteVendorCommandHandler>>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new DeleteVendorCommandHandler(
            _dbContextMock.Object,
            _currentUserMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ValidVendor_SetsDeletedAt()
    {
        // Arrange (AC #3, #5)
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        vendor.DeletedAt.Should().BeNull(); // Verify precondition
        var vendors = new List<Vendor> { vendor };
        SetupVendorsDbSet(vendors);

        var command = new DeleteVendorCommand(vendor.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.DeletedAt.Should().NotBeNull();
        vendor.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_ValidVendor_CallsSaveChanges()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        var vendors = new List<Vendor> { vendor };
        SetupVendorsDbSet(vendors);

        var command = new DeleteVendorCommand(vendor.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange (AC #6)
        var vendors = new List<Vendor>();
        SetupVendorsDbSet(vendors);

        var nonExistentId = Guid.NewGuid();
        var command = new DeleteVendorCommand(nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_VendorBelongsToOtherAccount_ThrowsNotFoundException()
    {
        // Arrange (AC #6)
        var otherAccountVendor = CreateVendor(_otherAccountId, "Jane", "Smith");
        var vendors = new List<Vendor> { otherAccountVendor };
        SetupVendorsDbSet(vendors);

        var command = new DeleteVendorCommand(otherAccountVendor.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_AlreadyDeletedVendor_ThrowsNotFoundException()
    {
        // Arrange - already deleted vendors should not be deletable again
        var deletedVendor = CreateVendor(_testAccountId, "Deleted", "Vendor");
        deletedVendor.DeletedAt = DateTime.UtcNow.AddDays(-1);
        var vendors = new List<Vendor> { deletedVendor };
        SetupVendorsDbSet(vendors);

        var command = new DeleteVendorCommand(deletedVendor.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_DoesNotChangeOtherVendorFields()
    {
        // Arrange
        var vendor = CreateVendor(_testAccountId, "John", "Doe");
        var originalFirstName = vendor.FirstName;
        var originalLastName = vendor.LastName;
        var originalAccountId = vendor.AccountId;
        var originalCreatedAt = vendor.CreatedAt;

        var vendors = new List<Vendor> { vendor };
        SetupVendorsDbSet(vendors);

        var command = new DeleteVendorCommand(vendor.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Only DeletedAt should change
        vendor.FirstName.Should().Be(originalFirstName);
        vendor.LastName.Should().Be(originalLastName);
        vendor.AccountId.Should().Be(originalAccountId);
        vendor.CreatedAt.Should().Be(originalCreatedAt);
    }

    private Vendor CreateVendor(Guid accountId, string firstName, string lastName)
    {
        return new Vendor
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FirstName = firstName,
            LastName = lastName,
            MiddleName = null,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-10),
            DeletedAt = null,
            Phones = new(),
            Emails = new(),
            TradeTagAssignments = new List<VendorTradeTagAssignment>()
        };
    }

    private void SetupVendorsDbSet(List<Vendor> vendors)
    {
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
    }
}
