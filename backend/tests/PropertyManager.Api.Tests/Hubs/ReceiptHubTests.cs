using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Api.Hubs;

namespace PropertyManager.Api.Tests.Hubs;

/// <summary>
/// Unit tests for ReceiptHub (AC-5.6.5 account-based group isolation).
/// </summary>
public class ReceiptHubTests
{
    private readonly Mock<ILogger<ReceiptHub>> _loggerMock;
    private readonly Mock<IHubCallerClients> _clientsMock;
    private readonly Mock<IGroupManager> _groupsMock;
    private readonly Mock<HubCallerContext> _contextMock;
    private readonly ReceiptHub _hub;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly string _testConnectionId = "test-connection-id";

    public ReceiptHubTests()
    {
        _loggerMock = new Mock<ILogger<ReceiptHub>>();
        _clientsMock = new Mock<IHubCallerClients>();
        _groupsMock = new Mock<IGroupManager>();
        _contextMock = new Mock<HubCallerContext>();

        _hub = new ReceiptHub(_loggerMock.Object)
        {
            Clients = _clientsMock.Object,
            Groups = _groupsMock.Object,
            Context = _contextMock.Object
        };
    }

    [Fact]
    public async Task OnConnectedAsync_WithAccountIdClaim_AddsUserToAccountGroup()
    {
        // Arrange
        var claims = new List<Claim>
        {
            new Claim("accountId", _testAccountId.ToString())
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _contextMock.Setup(c => c.User).Returns(principal);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);
        _contextMock.Setup(c => c.UserIdentifier).Returns("test-user");

        // Act
        await _hub.OnConnectedAsync();

        // Assert
        var expectedGroupName = $"account-{_testAccountId}";
        _groupsMock.Verify(g => g.AddToGroupAsync(
            _testConnectionId,
            expectedGroupName,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OnConnectedAsync_WithoutAccountIdClaim_DoesNotAddToGroup()
    {
        // Arrange
        var claims = new List<Claim>(); // No accountId claim
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _contextMock.Setup(c => c.User).Returns(principal);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);

        // Act
        await _hub.OnConnectedAsync();

        // Assert
        _groupsMock.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OnConnectedAsync_WithNullUser_DoesNotAddToGroup()
    {
        // Arrange
        _contextMock.Setup(c => c.User).Returns((ClaimsPrincipal?)null);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);

        // Act
        await _hub.OnConnectedAsync();

        // Assert
        _groupsMock.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithAccountIdClaim_RemovesUserFromAccountGroup()
    {
        // Arrange
        var claims = new List<Claim>
        {
            new Claim("accountId", _testAccountId.ToString())
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _contextMock.Setup(c => c.User).Returns(principal);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);
        _contextMock.Setup(c => c.UserIdentifier).Returns("test-user");

        // Act
        await _hub.OnDisconnectedAsync(null);

        // Assert
        var expectedGroupName = $"account-{_testAccountId}";
        _groupsMock.Verify(g => g.RemoveFromGroupAsync(
            _testConnectionId,
            expectedGroupName,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithoutAccountIdClaim_DoesNotRemoveFromGroup()
    {
        // Arrange
        var claims = new List<Claim>(); // No accountId claim
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _contextMock.Setup(c => c.User).Returns(principal);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);

        // Act
        await _hub.OnDisconnectedAsync(null);

        // Assert
        _groupsMock.Verify(g => g.RemoveFromGroupAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithException_StillRemovesFromGroup()
    {
        // Arrange
        var claims = new List<Claim>
        {
            new Claim("accountId", _testAccountId.ToString())
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _contextMock.Setup(c => c.User).Returns(principal);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);
        _contextMock.Setup(c => c.UserIdentifier).Returns("test-user");

        var testException = new InvalidOperationException("Connection error");

        // Act
        await _hub.OnDisconnectedAsync(testException);

        // Assert
        var expectedGroupName = $"account-{_testAccountId}";
        _groupsMock.Verify(g => g.RemoveFromGroupAsync(
            _testConnectionId,
            expectedGroupName,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OnConnectedAsync_UsesCorrectGroupNameFormat()
    {
        // Arrange
        var specificAccountId = Guid.Parse("12345678-1234-1234-1234-123456789012");
        var claims = new List<Claim>
        {
            new Claim("accountId", specificAccountId.ToString())
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _contextMock.Setup(c => c.User).Returns(principal);
        _contextMock.Setup(c => c.ConnectionId).Returns(_testConnectionId);
        _contextMock.Setup(c => c.UserIdentifier).Returns("test-user");

        // Act
        await _hub.OnConnectedAsync();

        // Assert - verify exact group name format
        _groupsMock.Verify(g => g.AddToGroupAsync(
            _testConnectionId,
            "account-12345678-1234-1234-1234-123456789012",
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
