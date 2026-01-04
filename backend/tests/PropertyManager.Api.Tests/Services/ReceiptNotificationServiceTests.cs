using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using PropertyManager.Api.Hubs;
using PropertyManager.Api.Services;
using PropertyManager.Application.Common.Interfaces;

namespace PropertyManager.Api.Tests.Services;

/// <summary>
/// Unit tests for ReceiptNotificationService (AC-5.6.1, AC-5.6.2, AC-5.6.5).
/// </summary>
public class ReceiptNotificationServiceTests
{
    private readonly Mock<IHubContext<ReceiptHub>> _hubContextMock;
    private readonly Mock<ILogger<ReceiptNotificationService>> _loggerMock;
    private readonly Mock<IHubClients> _clientsMock;
    private readonly Mock<IClientProxy> _clientProxyMock;
    private readonly ReceiptNotificationService _service;
    private readonly Guid _testAccountId = Guid.NewGuid();

    public ReceiptNotificationServiceTests()
    {
        _hubContextMock = new Mock<IHubContext<ReceiptHub>>();
        _loggerMock = new Mock<ILogger<ReceiptNotificationService>>();
        _clientsMock = new Mock<IHubClients>();
        _clientProxyMock = new Mock<IClientProxy>();

        _hubContextMock.Setup(h => h.Clients).Returns(_clientsMock.Object);

        _service = new ReceiptNotificationService(
            _hubContextMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task NotifyReceiptAddedAsync_BroadcastsToCorrectAccountGroup()
    {
        // Arrange
        var expectedGroupName = $"account-{_testAccountId}";
        _clientsMock.Setup(c => c.Group(expectedGroupName)).Returns(_clientProxyMock.Object);

        var receiptEvent = new ReceiptAddedEvent(
            Id: Guid.NewGuid(),
            ThumbnailUrl: null,
            PropertyId: Guid.NewGuid(),
            PropertyName: "Test Property",
            CreatedAt: DateTime.UtcNow);

        // Act
        await _service.NotifyReceiptAddedAsync(_testAccountId, receiptEvent, CancellationToken.None);

        // Assert
        _clientsMock.Verify(c => c.Group(expectedGroupName), Times.Once);
        _clientProxyMock.Verify(p => p.SendCoreAsync(
            "ReceiptAdded",
            It.Is<object[]>(args => args.Length == 1 && args[0] == receiptEvent),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotifyReceiptLinkedAsync_BroadcastsToCorrectAccountGroup()
    {
        // Arrange
        var expectedGroupName = $"account-{_testAccountId}";
        _clientsMock.Setup(c => c.Group(expectedGroupName)).Returns(_clientProxyMock.Object);

        var linkedEvent = new ReceiptLinkedEvent(
            ReceiptId: Guid.NewGuid(),
            ExpenseId: Guid.NewGuid());

        // Act
        await _service.NotifyReceiptLinkedAsync(_testAccountId, linkedEvent, CancellationToken.None);

        // Assert
        _clientsMock.Verify(c => c.Group(expectedGroupName), Times.Once);
        _clientProxyMock.Verify(p => p.SendCoreAsync(
            "ReceiptLinked",
            It.Is<object[]>(args => args.Length == 1 && args[0] == linkedEvent),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotifyReceiptDeletedAsync_BroadcastsToCorrectAccountGroup()
    {
        // Arrange
        var expectedGroupName = $"account-{_testAccountId}";
        var receiptId = Guid.NewGuid();
        _clientsMock.Setup(c => c.Group(expectedGroupName)).Returns(_clientProxyMock.Object);

        // Act
        await _service.NotifyReceiptDeletedAsync(_testAccountId, receiptId, CancellationToken.None);

        // Assert
        _clientsMock.Verify(c => c.Group(expectedGroupName), Times.Once);
        _clientProxyMock.Verify(p => p.SendCoreAsync(
            "ReceiptDeleted",
            It.Is<object[]>(args => args.Length == 1),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotifyReceiptAddedAsync_UsesCorrectGroupNameFormat()
    {
        // Arrange
        var specificAccountId = Guid.Parse("12345678-1234-1234-1234-123456789012");
        var expectedGroupName = "account-12345678-1234-1234-1234-123456789012";
        _clientsMock.Setup(c => c.Group(expectedGroupName)).Returns(_clientProxyMock.Object);

        var receiptEvent = new ReceiptAddedEvent(
            Id: Guid.NewGuid(),
            ThumbnailUrl: null,
            PropertyId: null,
            PropertyName: null,
            CreatedAt: DateTime.UtcNow);

        // Act
        await _service.NotifyReceiptAddedAsync(specificAccountId, receiptEvent, CancellationToken.None);

        // Assert
        _clientsMock.Verify(c => c.Group(expectedGroupName), Times.Once);
    }

    [Fact]
    public async Task NotifyReceiptAddedAsync_DifferentAccounts_BroadcastToDifferentGroups()
    {
        // Arrange
        var accountId1 = Guid.NewGuid();
        var accountId2 = Guid.NewGuid();

        _clientsMock.Setup(c => c.Group(It.IsAny<string>())).Returns(_clientProxyMock.Object);

        var receiptEvent = new ReceiptAddedEvent(
            Id: Guid.NewGuid(),
            ThumbnailUrl: null,
            PropertyId: null,
            PropertyName: null,
            CreatedAt: DateTime.UtcNow);

        // Act
        await _service.NotifyReceiptAddedAsync(accountId1, receiptEvent, CancellationToken.None);
        await _service.NotifyReceiptAddedAsync(accountId2, receiptEvent, CancellationToken.None);

        // Assert - verify each account gets its own group
        _clientsMock.Verify(c => c.Group($"account-{accountId1}"), Times.Once);
        _clientsMock.Verify(c => c.Group($"account-{accountId2}"), Times.Once);
    }
}
