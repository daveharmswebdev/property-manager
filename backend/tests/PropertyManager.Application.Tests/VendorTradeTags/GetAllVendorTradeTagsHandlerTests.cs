using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.VendorTradeTags;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.VendorTradeTags;

/// <summary>
/// Unit tests for GetAllVendorTradeTagsQueryHandler (AC #3).
/// </summary>
public class GetAllVendorTradeTagsHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly GetAllVendorTradeTagsQueryHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();

    public GetAllVendorTradeTagsHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        _handler = new GetAllVendorTradeTagsQueryHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_NoTradeTags_ReturnsEmptyList()
    {
        // Arrange
        var tradeTags = new List<VendorTradeTag>();
        SetupTradeTagsDbSet(tradeTags);
        var query = new GetAllVendorTradeTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WithTradeTags_ReturnsAllForAccount()
    {
        // Arrange
        var tradeTags = new List<VendorTradeTag>
        {
            CreateTradeTag(_testAccountId, "Plumber"),
            CreateTradeTag(_testAccountId, "Electrician"),
            CreateTradeTag(_otherAccountId, "OtherAccountTag")
        };
        SetupTradeTagsDbSet(tradeTags);
        var query = new GetAllVendorTradeTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(t => t.Name == "Plumber" || t.Name == "Electrician");
    }

    [Fact]
    public async Task Handle_TradeTagsSortedAlphabeticallyByName()
    {
        // Arrange
        var tradeTags = new List<VendorTradeTag>
        {
            CreateTradeTag(_testAccountId, "Plumber"),
            CreateTradeTag(_testAccountId, "Electrician"),
            CreateTradeTag(_testAccountId, "HVAC Tech"),
            CreateTradeTag(_testAccountId, "Carpenter")
        };
        SetupTradeTagsDbSet(tradeTags);
        var query = new GetAllVendorTradeTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(4);
        result.Items[0].Name.Should().Be("Carpenter");
        result.Items[1].Name.Should().Be("Electrician");
        result.Items[2].Name.Should().Be("HVAC Tech");
        result.Items[3].Name.Should().Be("Plumber");
    }

    [Fact]
    public async Task Handle_ReturnsCorrectDto()
    {
        // Arrange
        var tradeTag = CreateTradeTag(_testAccountId, "Plumber");
        var tradeTags = new List<VendorTradeTag> { tradeTag };
        SetupTradeTagsDbSet(tradeTags);
        var query = new GetAllVendorTradeTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        var dto = result.Items[0];
        dto.Id.Should().Be(tradeTag.Id);
        dto.Name.Should().Be("Plumber");
    }

    [Fact]
    public async Task Handle_MultiTenantIsolation_OnlyReturnsCurrentAccountTags()
    {
        // Arrange
        var tradeTags = new List<VendorTradeTag>
        {
            CreateTradeTag(_testAccountId, "MyTag1"),
            CreateTradeTag(_testAccountId, "MyTag2"),
            CreateTradeTag(_otherAccountId, "OtherTag1"),
            CreateTradeTag(_otherAccountId, "OtherTag2"),
            CreateTradeTag(Guid.NewGuid(), "ThirdAccountTag")
        };
        SetupTradeTagsDbSet(tradeTags);
        var query = new GetAllVendorTradeTagsQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(t => t.Name.StartsWith("MyTag"));
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

    private void SetupTradeTagsDbSet(List<VendorTradeTag> tradeTags)
    {
        var mockDbSet = tradeTags.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.VendorTradeTags).Returns(mockDbSet.Object);
    }
}
