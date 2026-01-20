using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrderTags;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrderTags;

/// <summary>
/// Unit tests for CreateWorkOrderTagCommandHandler (AC #2, #3).
/// </summary>
public class CreateWorkOrderTagHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateWorkOrderTagCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();
    private List<WorkOrderTag> _tags = new();

    public CreateWorkOrderTagHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new CreateWorkOrderTagCommandHandler(_dbContextMock.Object, _currentUserMock.Object);

        SetupTagsDbSet(_tags);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
    }

    [Fact]
    public async Task Handle_ValidName_CreatesTagWithCorrectAccountId()
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand("Urgent");
        WorkOrderTag? addedTag = null;
        _dbContextMock.Setup(x => x.WorkOrderTags.Add(It.IsAny<WorkOrderTag>()))
            .Callback<WorkOrderTag>(tag => addedTag = tag);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedTag.Should().NotBeNull();
        addedTag!.AccountId.Should().Be(_testAccountId);
        addedTag.Name.Should().Be("Urgent");
    }

    [Fact]
    public async Task Handle_ValidName_ReturnsNewTagId()
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand("Warranty");
        WorkOrderTag? addedTag = null;
        _dbContextMock.Setup(x => x.WorkOrderTags.Add(It.IsAny<WorkOrderTag>()))
            .Callback<WorkOrderTag>(tag => addedTag = tag);

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
        var command = new CreateWorkOrderTagCommand("  Urgent  ");
        WorkOrderTag? addedTag = null;
        _dbContextMock.Setup(x => x.WorkOrderTags.Add(It.IsAny<WorkOrderTag>()))
            .Callback<WorkOrderTag>(tag => addedTag = tag);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        addedTag!.Name.Should().Be("Urgent");
    }

    [Fact]
    public async Task Handle_ValidName_SetsCreatedAt()
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand("Urgent");
        var beforeTime = DateTime.UtcNow;
        WorkOrderTag? addedTag = null;
        _dbContextMock.Setup(x => x.WorkOrderTags.Add(It.IsAny<WorkOrderTag>()))
            .Callback<WorkOrderTag>(tag => addedTag = tag);

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
        var existingTags = new List<WorkOrderTag>
        {
            new WorkOrderTag
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                Name = "Urgent",
                CreatedAt = DateTime.UtcNow
            }
        };
        SetupTagsDbSet(existingTags);
        var command = new CreateWorkOrderTagCommand("Urgent");

        // Act & Assert
        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<ConflictException>()
            .WithMessage("*Urgent*");
    }

    [Fact]
    public async Task Handle_DuplicateNameCaseInsensitive_ThrowsConflictException()
    {
        // Arrange
        var existingTags = new List<WorkOrderTag>
        {
            new WorkOrderTag
            {
                Id = Guid.NewGuid(),
                AccountId = _testAccountId,
                Name = "Urgent",
                CreatedAt = DateTime.UtcNow
            }
        };
        SetupTagsDbSet(existingTags);
        var command = new CreateWorkOrderTagCommand("URGENT");

        // Act & Assert
        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Handle_SameNameInDifferentAccount_Succeeds()
    {
        // Arrange
        var existingTags = new List<WorkOrderTag>
        {
            new WorkOrderTag
            {
                Id = Guid.NewGuid(),
                AccountId = _otherAccountId,
                Name = "Urgent",
                CreatedAt = DateTime.UtcNow
            }
        };
        SetupTagsDbSet(existingTags);
        var command = new CreateWorkOrderTagCommand("Urgent");
        WorkOrderTag? addedTag = null;
        _dbContextMock.Setup(x => x.WorkOrderTags.Add(It.IsAny<WorkOrderTag>()))
            .Callback<WorkOrderTag>(tag => addedTag = tag);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe(Guid.Empty);
        addedTag.Should().NotBeNull();
        addedTag!.Name.Should().Be("Urgent");
    }

    [Fact]
    public async Task Handle_CallsSaveChangesAsync()
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand("Urgent");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private void SetupTagsDbSet(List<WorkOrderTag> tags)
    {
        var mockDbSet = tags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderTags).Returns(mockDbSet.Object);
    }
}
