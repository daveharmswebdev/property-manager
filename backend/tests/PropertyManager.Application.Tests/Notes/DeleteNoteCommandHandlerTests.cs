using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Notes;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.Notes;

/// <summary>
/// Unit tests for DeleteNoteCommandHandler (AC #6).
/// Tests soft delete behavior for notes with tenant isolation.
/// </summary>
public class DeleteNoteCommandHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly DeleteNoteCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public DeleteNoteCommandHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new DeleteNoteCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ExistingNote_SoftDeletes()
    {
        // Arrange (AC #6)
        var note = CreateNote(_testAccountId);
        note.DeletedAt.Should().BeNull(); // Verify precondition
        var notes = new List<Note> { note };
        SetupNotesDbSet(notes);

        var command = new DeleteNoteCommand(note.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        note.DeletedAt.Should().NotBeNull();
        note.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_ExistingNote_CallsSaveChanges()
    {
        // Arrange
        var note = CreateNote(_testAccountId);
        var notes = new List<Note> { note };
        SetupNotesDbSet(notes);

        var command = new DeleteNoteCommand(note.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NonExistentNote_ThrowsNotFoundException()
    {
        // Arrange
        var notes = new List<Note>();
        SetupNotesDbSet(notes);

        var nonExistentId = Guid.NewGuid();
        var command = new DeleteNoteCommand(nonExistentId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{nonExistentId}*");
    }

    [Fact]
    public async Task Handle_DifferentAccount_ThrowsNotFoundException_TenantIsolation()
    {
        // Arrange - Note belongs to different account
        var otherAccountNote = CreateNote(_otherAccountId);
        var notes = new List<Note> { otherAccountNote };
        SetupNotesDbSet(notes);

        var command = new DeleteNoteCommand(otherAccountNote.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert - Should throw not found (not unauthorized) to prevent data leakage
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_SetsDeletedAtTimestamp()
    {
        // Arrange (AC #6)
        var note = CreateNote(_testAccountId);
        var notes = new List<Note> { note };
        SetupNotesDbSet(notes);

        var beforeDelete = DateTime.UtcNow;
        var command = new DeleteNoteCommand(note.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        note.DeletedAt.Should().NotBeNull();
        note.DeletedAt.Should().BeOnOrAfter(beforeDelete);
        note.DeletedAt.Should().BeOnOrBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public async Task Handle_AlreadyDeletedNote_ThrowsNotFoundException()
    {
        // Arrange - Already deleted note should not be deletable again
        var deletedNote = CreateNote(_testAccountId);
        deletedNote.DeletedAt = DateTime.UtcNow.AddDays(-1);
        var notes = new List<Note> { deletedNote };
        SetupNotesDbSet(notes);

        var command = new DeleteNoteCommand(deletedNote.Id);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_DoesNotChangeOtherNoteFields()
    {
        // Arrange
        var note = CreateNote(_testAccountId);
        var originalContent = note.Content;
        var originalEntityType = note.EntityType;
        var originalEntityId = note.EntityId;
        var originalAccountId = note.AccountId;
        var originalCreatedAt = note.CreatedAt;

        var notes = new List<Note> { note };
        SetupNotesDbSet(notes);

        var command = new DeleteNoteCommand(note.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert - Only DeletedAt should change
        note.Content.Should().Be(originalContent);
        note.EntityType.Should().Be(originalEntityType);
        note.EntityId.Should().Be(originalEntityId);
        note.AccountId.Should().Be(originalAccountId);
        note.CreatedAt.Should().Be(originalCreatedAt);
    }

    private Note CreateNote(Guid accountId)
    {
        return new Note
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            EntityType = "WorkOrder",
            EntityId = Guid.NewGuid(),
            Content = "Test note content",
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-10),
            DeletedAt = null
        };
    }

    private void SetupNotesDbSet(List<Note> notes)
    {
        var mockDbSet = notes.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Notes).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
    }
}
