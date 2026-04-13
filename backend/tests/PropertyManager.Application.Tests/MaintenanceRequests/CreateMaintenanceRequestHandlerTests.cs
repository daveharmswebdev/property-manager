using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.MaintenanceRequests;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for CreateMaintenanceRequestCommandHandler (AC #4).
/// </summary>
public class CreateMaintenanceRequestHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateMaintenanceRequestCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testPropertyId = Guid.NewGuid();
    private readonly List<MaintenanceRequest> _addedRequests = new();

    public CreateMaintenanceRequestHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.PropertyId).Returns(_testPropertyId);
        _currentUserMock.Setup(x => x.Role).Returns("Tenant");
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        // Setup MaintenanceRequests DbSet with Add tracking
        var requests = new List<MaintenanceRequest>();
        var mockDbSet = requests.BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<MaintenanceRequest>()))
            .Callback<MaintenanceRequest>(r => _addedRequests.Add(r));
        _dbContextMock.Setup(x => x.MaintenanceRequests).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new CreateMaintenanceRequestCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidDescription_CreatesRequestWithCorrectFields()
    {
        // Arrange
        var command = new CreateMaintenanceRequestCommand("Leaky faucet in the kitchen");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedRequests.Should().HaveCount(1);
        var request = _addedRequests[0];
        request.Status.Should().Be(MaintenanceRequestStatus.Submitted);
        request.PropertyId.Should().Be(_testPropertyId);
        request.SubmittedByUserId.Should().Be(_testUserId);
        request.AccountId.Should().Be(_testAccountId);
        request.Description.Should().Be("Leaky faucet in the kitchen");
    }

    [Fact]
    public async Task Handle_TrimsDescriptionWhitespace()
    {
        // Arrange
        var command = new CreateMaintenanceRequestCommand("  Leaky faucet  ");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedRequests.Should().HaveCount(1);
        _addedRequests[0].Description.Should().Be("Leaky faucet");
    }

    [Fact]
    public async Task Handle_CurrentUserPropertyIdNull_ThrowsBusinessRuleException()
    {
        // Arrange
        _currentUserMock.Setup(x => x.PropertyId).Returns((Guid?)null);
        var command = new CreateMaintenanceRequestCommand("Leaky faucet");

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*assigned property*");
    }

    [Fact]
    public async Task Handle_CallsSaveChangesAsyncExactlyOnce()
    {
        // Arrange
        var command = new CreateMaintenanceRequestCommand("Leaky faucet");

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
