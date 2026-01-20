using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrderTags;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.WorkOrderTags;

/// <summary>
/// Unit tests for GetAllWorkOrderTagsQueryHandler (AC #1).
/// </summary>
public class GetAllWorkOrderTagsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetAllWorkOrderTagsQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetAllWorkOrderTagsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetAllWorkOrderTagsQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_NoTags_ReturnsEmptyList()
    {
        // Arrange
        var tags = new List<WorkOrderTag>();
        SetupTagsDbSet(tags);
        var query = new GetAllWorkOrderTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WithTags_ReturnsAllForAccount()
    {
        // Arrange
        var tags = new List<WorkOrderTag>
        {
            CreateTag(_testAccountId, "Urgent"),
            CreateTag(_testAccountId, "Warranty"),
            CreateTag(_otherAccountId, "OtherAccountTag")
        };
        SetupTagsDbSet(tags);
        var query = new GetAllWorkOrderTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(t => t.Name == "Urgent" || t.Name == "Warranty");
    }

    [Fact]
    public async Task Handle_TagsSortedAlphabeticallyByName()
    {
        // Arrange
        var tags = new List<WorkOrderTag>
        {
            CreateTag(_testAccountId, "Urgent"),
            CreateTag(_testAccountId, "Appliance"),
            CreateTag(_testAccountId, "Warranty"),
            CreateTag(_testAccountId, "Deferred")
        };
        SetupTagsDbSet(tags);
        var query = new GetAllWorkOrderTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(4);
        result.Items[0].Name.Should().Be("Appliance");
        result.Items[1].Name.Should().Be("Deferred");
        result.Items[2].Name.Should().Be("Urgent");
        result.Items[3].Name.Should().Be("Warranty");
    }

    [Fact]
    public async Task Handle_ReturnsCorrectDto()
    {
        // Arrange
        var tag = CreateTag(_testAccountId, "Urgent");
        var tags = new List<WorkOrderTag> { tag };
        SetupTagsDbSet(tags);
        var query = new GetAllWorkOrderTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Id.Should().Be(tag.Id);
        dto.Name.Should().Be("Urgent");
    }

    [Fact]
    public async Task Handle_MultiTenantIsolation_OnlyReturnsCurrentAccountTags()
    {
        // Arrange
        var tags = new List<WorkOrderTag>
        {
            CreateTag(_testAccountId, "MyTag1"),
            CreateTag(_testAccountId, "MyTag2"),
            CreateTag(_otherAccountId, "OtherTag1"),
            CreateTag(_otherAccountId, "OtherTag2"),
            CreateTag(Guid.NewGuid(), "ThirdAccountTag")
        };
        SetupTagsDbSet(tags);
        var query = new GetAllWorkOrderTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(t => t.Name.StartsWith("MyTag"));
    }

    private WorkOrderTag CreateTag(Guid accountId, string name)
    {
        return new WorkOrderTag
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = name,
            CreatedAt = DateTime.UtcNow
        };
    }

    private void SetupTagsDbSet(List<WorkOrderTag> tags)
    {
        var mockDbSet = tags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.WorkOrderTags).Returns(mockDbSet.Object);
    }
}
