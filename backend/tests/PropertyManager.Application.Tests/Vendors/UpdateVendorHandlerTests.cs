using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Vendors;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for UpdateVendorCommandHandler (AC #12, #13, #15).
/// </summary>
public class UpdateVendorHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly UpdateVendorCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public UpdateVendorHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new UpdateVendorCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_UpdatesPersonFields_Success()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag>());

        var command = new UpdateVendorCommand(
            vendorId,
            "Jane",
            "Middle",
            "Smith",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.FirstName.Should().Be("Jane");
        vendor.MiddleName.Should().Be("Middle");
        vendor.LastName.Should().Be("Smith");
        _dbContextMock.Verify(x => x.SaveChangesAsync(CancellationToken.None), Times.Once);
    }

    [Fact]
    public async Task Handle_UpdatesPhones_Success()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag>());

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>
            {
                new("512-555-1234", "Mobile"),
                new("512-555-5678", "Office")
            },
            new List<string>(),
            new List<Guid>()
        );

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.Phones.Should().HaveCount(2);
        vendor.Phones[0].Number.Should().Be("512-555-1234");
        vendor.Phones[0].Label.Should().Be("Mobile");
        vendor.Phones[1].Number.Should().Be("512-555-5678");
        vendor.Phones[1].Label.Should().Be("Office");
    }

    [Fact]
    public async Task Handle_UpdatesEmails_Success()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag>());

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string> { "john@example.com", "john.work@example.com" },
            new List<Guid>()
        );

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.Emails.Should().HaveCount(2);
        vendor.Emails.Should().Contain("john@example.com");
        vendor.Emails.Should().Contain("john.work@example.com");
    }

    [Fact]
    public async Task Handle_AddsTradeTagAssignments_Success()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        var tag1 = CreateTradeTag(_testAccountId, "Plumber");
        var tag2 = CreateTradeTag(_testAccountId, "Electrician");

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag> { tag1, tag2 });

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid> { tag1.Id, tag2.Id }
        );

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.TradeTagAssignments.Should().HaveCount(2);
        vendor.TradeTagAssignments.Select(a => a.TradeTagId).Should().Contain(tag1.Id);
        vendor.TradeTagAssignments.Select(a => a.TradeTagId).Should().Contain(tag2.Id);
    }

    [Fact]
    public async Task Handle_RemovesOldTradeTagAssignments_Success()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        var tag1 = CreateTradeTag(_testAccountId, "Plumber");
        var tag2 = CreateTradeTag(_testAccountId, "Electrician");

        // Vendor initially has tag1 assigned
        vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment
        {
            VendorId = vendorId,
            TradeTagId = tag1.Id
        });

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag> { tag1, tag2 });

        // Update to have only tag2
        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid> { tag2.Id }
        );

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.TradeTagAssignments.Should().HaveCount(1);
        vendor.TradeTagAssignments.First().TradeTagId.Should().Be(tag2.Id);
    }

    [Fact]
    public async Task Handle_SyncsTradeTagAssignments_AddAndRemove()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        var tag1 = CreateTradeTag(_testAccountId, "Plumber");
        var tag2 = CreateTradeTag(_testAccountId, "Electrician");
        var tag3 = CreateTradeTag(_testAccountId, "HVAC");

        // Vendor initially has tag1 and tag2 assigned
        vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment { VendorId = vendorId, TradeTagId = tag1.Id });
        vendor.TradeTagAssignments.Add(new VendorTradeTagAssignment { VendorId = vendorId, TradeTagId = tag2.Id });

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag> { tag1, tag2, tag3 });

        // Update to have tag2 and tag3 (remove tag1, keep tag2, add tag3)
        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid> { tag2.Id, tag3.Id }
        );

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        vendor.TradeTagAssignments.Should().HaveCount(2);
        vendor.TradeTagAssignments.Select(a => a.TradeTagId).Should().Contain(tag2.Id);
        vendor.TradeTagAssignments.Select(a => a.TradeTagId).Should().Contain(tag3.Id);
        vendor.TradeTagAssignments.Select(a => a.TradeTagId).Should().NotContain(tag1.Id);
    }

    [Fact]
    public async Task Handle_VendorNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var nonExistentId = Guid.NewGuid();
        SetupVendorsDbSet(new List<Vendor>());
        SetupTradeTagsDbSet(new List<VendorTradeTag>());

        var command = new UpdateVendorCommand(
            nonExistentId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Vendor*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_VendorBelongsToOtherAccount_ThrowsNotFoundException()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _otherAccountId, "John", "Doe");
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag>());

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_VendorIsDeleted_ThrowsNotFoundException()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        vendor.DeletedAt = DateTime.UtcNow;
        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag>());

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_InvalidTradeTagId_ThrowsValidationException()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        var invalidTagId = Guid.NewGuid();

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag>()); // No valid tags

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid> { invalidTagId }
        );

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainKey("tradeTagIds");
        exception.Which.Errors["tradeTagIds"].Should().Contain(e => e.Contains("Invalid trade tag IDs"));
    }

    [Fact]
    public async Task Handle_TradeTagBelongsToOtherAccount_ThrowsValidationException()
    {
        // Arrange
        var vendorId = Guid.NewGuid();
        var vendor = CreateVendor(vendorId, _testAccountId, "John", "Doe");
        var otherAccountTag = CreateTradeTag(_otherAccountId, "Other Tag");

        SetupVendorsDbSet(new List<Vendor> { vendor });
        SetupTradeTagsDbSet(new List<VendorTradeTag> { otherAccountTag });

        var command = new UpdateVendorCommand(
            vendorId,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid> { otherAccountTag.Id }
        );

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainKey("tradeTagIds");
        exception.Which.Errors["tradeTagIds"].Should().Contain(e => e.Contains("Invalid trade tag IDs"));
    }

    private Vendor CreateVendor(Guid id, Guid accountId, string firstName, string lastName, string? middleName = null)
    {
        return new Vendor
        {
            Id = id,
            AccountId = accountId,
            FirstName = firstName,
            MiddleName = middleName,
            LastName = lastName,
            Phones = new List<PhoneNumber>(),
            Emails = new List<string>(),
            TradeTagAssignments = new List<VendorTradeTagAssignment>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private VendorTradeTag CreateTradeTag(Guid accountId, string name)
    {
        return new VendorTradeTag
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = name,
            CreatedAt = DateTime.UtcNow
        };
    }

    private void SetupVendorsDbSet(List<Vendor> vendors)
    {
        var mockDbSet = vendors.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Vendors).Returns(mockDbSet.Object);
    }

    private void SetupTradeTagsDbSet(List<VendorTradeTag> tags)
    {
        var mockDbSet = tags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.VendorTradeTags).Returns(mockDbSet.Object);
    }
}
