using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Notes;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Notes;

/// <summary>
/// Unit tests for GetNotesQueryHandler (AC #4, #8).
/// Tests note retrieval with tenant isolation, sorting, and soft delete filtering.
/// </summary>
public class GetNotesQueryHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetNotesQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetNotesQueryHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();

        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetNotesQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_NotesExist_ReturnsNotesForEntity()
    {
        // Arrange
        var entityId = Guid.NewGuid();
        var notes = new List<Note>
        {
            CreateNote(_testAccountId, "WorkOrder", entityId, "Note 1"),
            CreateNote(_testAccountId, "WorkOrder", entityId, "Note 2"),
            CreateNote(_testAccountId, "WorkOrder", Guid.NewGuid(), "Different entity note")
        };
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", entityId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_NoNotes_ReturnsEmptyList()
    {
        // Arrange
        var notes = new List<Note>();
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", Guid.NewGuid());

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_DifferentAccount_ReturnsEmpty_TenantIsolation()
    {
        // Arrange (AC #8)
        var entityId = Guid.NewGuid();
        var notes = new List<Note>
        {
            CreateNote(_otherAccountId, "WorkOrder", entityId, "Other account note")
        };
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", entityId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert - Should not see notes from other account
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_MultipleNotes_OrdersByCreatedAtDesc()
    {
        // Arrange (AC #4)
        var entityId = Guid.NewGuid();
        var oldestNote = CreateNote(_testAccountId, "WorkOrder", entityId, "Oldest");
        oldestNote.CreatedAt = DateTime.UtcNow.AddDays(-3);

        var newestNote = CreateNote(_testAccountId, "WorkOrder", entityId, "Newest");
        newestNote.CreatedAt = DateTime.UtcNow;

        var middleNote = CreateNote(_testAccountId, "WorkOrder", entityId, "Middle");
        middleNote.CreatedAt = DateTime.UtcNow.AddDays(-1);

        var notes = new List<Note> { oldestNote, newestNote, middleNote };
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", entityId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert - Should be ordered newest first
        result.Items.Should().HaveCount(3);
        result.Items[0].Content.Should().Be("Newest");
        result.Items[1].Content.Should().Be("Middle");
        result.Items[2].Content.Should().Be("Oldest");
    }

    [Fact]
    public async Task Handle_SoftDeletedNotes_ExcludesFromResults()
    {
        // Arrange
        var entityId = Guid.NewGuid();
        var activeNote = CreateNote(_testAccountId, "WorkOrder", entityId, "Active");
        var deletedNote = CreateNote(_testAccountId, "WorkOrder", entityId, "Deleted");
        deletedNote.DeletedAt = DateTime.UtcNow;

        var notes = new List<Note> { activeNote, deletedNote };
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", entityId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert - Should only return active notes
        result.Items.Should().HaveCount(1);
        result.Items[0].Content.Should().Be("Active");
    }

    [Fact]
    public async Task Handle_IncludesCreatedByUserName()
    {
        // Arrange (AC #4)
        var entityId = Guid.NewGuid();
        var note = CreateNote(_testAccountId, "WorkOrder", entityId, "Test note");
        var notes = new List<Note> { note };
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", entityId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].CreatedByUserName.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Handle_FiltersByEntityType()
    {
        // Arrange
        var entityId = Guid.NewGuid();
        var notes = new List<Note>
        {
            CreateNote(_testAccountId, "WorkOrder", entityId, "WorkOrder note"),
            CreateNote(_testAccountId, "Vendor", entityId, "Vendor note")
        };
        SetupNotesDbSet(notes);

        var query = new GetNotesQuery("WorkOrder", entityId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Content.Should().Be("WorkOrder note");
    }

    private Note CreateNote(Guid accountId, string entityType, Guid entityId, string content)
    {
        return new Note
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            EntityType = entityType,
            EntityId = entityId,
            Content = content,
            CreatedByUserId = _testUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            DeletedAt = null
        };
    }

    private void SetupNotesDbSet(List<Note> notes)
    {
        var mockDbSet = notes.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Notes).Returns(mockDbSet.Object);
    }
}
