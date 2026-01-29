using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Notes;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Notes;

/// <summary>
/// Unit tests for CreateNoteCommandHandler (AC #5).
/// Tests note creation with correct AccountId, UserId, timestamps.
/// </summary>
public class CreateNoteCommandHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateNoteCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();

    public CreateNoteCommandHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        // Setup Notes DbSet
        var notes = new List<Note>().AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Notes).Returns(notes.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new CreateNoteCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_CreatesNoteWithCorrectAccountId()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "Test note content");
        Note? capturedNote = null;
        _dbContextMock.Setup(x => x.Notes.Add(It.IsAny<Note>()))
            .Callback<Note>(n => capturedNote = n);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedNote.Should().NotBeNull();
        capturedNote!.AccountId.Should().Be(_testAccountId);
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsCreatedByUserId()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "Test note content");
        Note? capturedNote = null;
        _dbContextMock.Setup(x => x.Notes.Add(It.IsAny<Note>()))
            .Callback<Note>(n => capturedNote = n);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedNote.Should().NotBeNull();
        capturedNote!.CreatedByUserId.Should().Be(_testUserId);
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsEntityTypeAndEntityId()
    {
        // Arrange
        var entityId = Guid.NewGuid();
        var command = new CreateNoteCommand("WorkOrder", entityId, "Test note content");
        Note? capturedNote = null;
        _dbContextMock.Setup(x => x.Notes.Add(It.IsAny<Note>()))
            .Callback<Note>(n => capturedNote = n);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedNote.Should().NotBeNull();
        capturedNote!.EntityType.Should().Be("WorkOrder");
        capturedNote.EntityId.Should().Be(entityId);
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsContent()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "Test note content");
        Note? capturedNote = null;
        _dbContextMock.Setup(x => x.Notes.Add(It.IsAny<Note>()))
            .Callback<Note>(n => capturedNote = n);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedNote.Should().NotBeNull();
        capturedNote!.Content.Should().Be("Test note content");
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsNewNoteId()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "Test note content");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsSaveChanges()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "Test note content");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidCommand_TrimsContent()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "  Test note content  ");
        Note? capturedNote = null;
        _dbContextMock.Setup(x => x.Notes.Add(It.IsAny<Note>()))
            .Callback<Note>(n => capturedNote = n);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        capturedNote.Should().NotBeNull();
        capturedNote!.Content.Should().Be("Test note content");
    }
}
