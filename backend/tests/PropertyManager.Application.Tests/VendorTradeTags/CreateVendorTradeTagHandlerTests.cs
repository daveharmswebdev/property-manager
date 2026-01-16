using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorTradeTags;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.VendorTradeTags;

/// <summary>
/// Unit tests for CreateVendorTradeTagCommandHandler (AC #4, #5).
/// </summary>
public class CreateVendorTradeTagHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateVendorTradeTagCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();
    private List<VendorTradeTag> _tradeTags = new();

    public CreateVendorTradeTagHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new CreateVendorTradeTagCommandHandler(_dbContextMock.Object, _currentUserMock.Object);

        SetupTradeTagsDbSet(_tradeTags);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
    }

    [Fact]
    public async Task Handle_ValidName_CreatesTagWithCorrectAccountId()
    {
        // Arrange
        var command = new CreateVendorTradeTagCommand("Plumber");
        VendorTradeTag? addedTag = null;
        _dbContextMock.Setup(x => x.VendorTradeTags.Add(It.IsAny<VendorTradeTag>()))
            .Callback<VendorTradeTag>(tag => addedTag = tag);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedTag.Should().NotBeNull();
        addedTag!.AccountId.Should().Be(_testAccountId);
        addedTag.Name.Should().Be("Plumber");
    }

    [Fact]
    public async Task Handle_ValidName_ReturnsNewTagId()
    {
        // Arrange
        var command = new CreateVendorTradeTagCommand("Electrician");
        VendorTradeTag? addedTag = null;
        _dbContextMock.Setup(x => x.VendorTradeTags.Add(It.IsAny<VendorTradeTag>()))
            .Callback<VendorTradeTag>(tag => addedTag = tag);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe(Guid.Empty);
        addedTag!.Id.Should().Be(result);
    }

    [Fact]
    public async Task Handle_ValidName_TrimsWhitespace()
    {
        // Arrange
        var command = new CreateVendorTradeTagCommand("  Plumber  ");
        VendorTradeTag? addedTag = null;
        _dbContextMock.Setup(x => x.VendorTradeTags.Add(It.IsAny<VendorTradeTag>()))
            .Callback<VendorTradeTag>(tag => addedTag = tag);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedTag!.Name.Should().Be("Plumber");
    }

    [Fact]
    public async Task Handle_ValidName_SetsCreatedAt()
    {
        // Arrange
        var command = new CreateVendorTradeTagCommand("Plumber");
        var beforeTime = DateTime.UtcNow;
        VendorTradeTag? addedTag = null;
        _dbContextMock.Setup(x => x.VendorTradeTags.Add(It.IsAny<VendorTradeTag>()))
            .Callback<VendorTradeTag>(tag => addedTag = tag);

        // Act
        await _handler.Handle(command, CancellationToken.None);
        var afterTime = DateTime.UtcNow;

        // Assert
        addedTag!.CreatedAt.Should().BeOnOrAfter(beforeTime);
        addedTag.CreatedAt.Should().BeOnOrBefore(afterTime);
    }

    [Fact]
    public async Task Handle_DuplicateName_ThrowsConflictException()
    {
        // Arrange
        var existingTags = new List<VendorTradeTag>
        {
            new VendorTradeTag
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                Name = "Plumber",
                CreatedAt = DateTime.UtcNow
            }
        };
        SetupTradeTagsDbSet(existingTags);
        var command = new CreateVendorTradeTagCommand("Plumber");

        // Act & Assert
        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<ConflictException>()
            .WithMessage("*Plumber*");
    }

    [Fact]
    public async Task Handle_DuplicateNameCaseInsensitive_ThrowsConflictException()
    {
        // Arrange
        var existingTags = new List<VendorTradeTag>
        {
            new VendorTradeTag
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                Name = "Plumber",
                CreatedAt = DateTime.UtcNow
            }
        };
        SetupTradeTagsDbSet(existingTags);
        var command = new CreateVendorTradeTagCommand("PLUMBER");

        // Act & Assert
        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Handle_SameNameInDifferentAccount_Succeeds()
    {
        // Arrange
        var existingTags = new List<VendorTradeTag>
        {
            new VendorTradeTag
            {
                Id = Guid.NewGuid(),
                AccountId = _otherAccountId,
                Name = "Plumber",
                CreatedAt = DateTime.UtcNow
            }
        };
        SetupTradeTagsDbSet(existingTags);
        var command = new CreateVendorTradeTagCommand("Plumber");
        VendorTradeTag? addedTag = null;
        _dbContextMock.Setup(x => x.VendorTradeTags.Add(It.IsAny<VendorTradeTag>()))
            .Callback<VendorTradeTag>(tag => addedTag = tag);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe(Guid.Empty);
        addedTag.Should().NotBeNull();
        addedTag!.Name.Should().Be("Plumber");
    }

    [Fact]
    public async Task Handle_CallsSaveChangesAsync()
    {
        // Arrange
        var command = new CreateVendorTradeTagCommand("Plumber");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private void SetupTradeTagsDbSet(List<VendorTradeTag> tradeTags)
    {
        var mockDbSet = tradeTags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.VendorTradeTags).Returns(mockDbSet.Object);
    }
}
