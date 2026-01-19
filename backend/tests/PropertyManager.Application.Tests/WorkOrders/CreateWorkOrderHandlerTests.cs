using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for CreateWorkOrderCommandHandler (AC #1, #2, #4).
/// </summary>
public class CreateWorkOrderHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly Mock<ICurrentUser> _currentUserMock;
    private readonly CreateWorkOrderCommandHandler _handler;
    private readonly Guid _testAccountId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _otherAccountId = Guid.NewGuid();
    private readonly List<WorkOrder> _addedWorkOrders = new();

    public CreateWorkOrderHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _currentUserMock = new Mock<ICurrentUser>();
        _currentUserMock.Setup(x => x.AccountId).Returns(_testAccountId);
        _currentUserMock.Setup(x => x.UserId).Returns(_testUserId);
        _currentUserMock.Setup(x => x.IsAuthenticated).Returns(true);

        // Setup WorkOrders DbSet with Add tracking
        var workOrders = new List<WorkOrder>();
        var mockDbSet = workOrders.AsQueryable().BuildMockDbSet();
        mockDbSet.Setup(x => x.Add(It.IsAny<WorkOrder>()))
            .Callback<WorkOrder>(w => _addedWorkOrders.Add(w));
        _dbContextMock.Setup(x => x.WorkOrders).Returns(mockDbSet.Object);
        _dbContextMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _handler = new CreateWorkOrderCommandHandler(_dbContextMock.Object, _currentUserMock.Object);
    }

    [Fact]
    public async Task Handle_ValidCommandWithAllFields_CreatesWorkOrder()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);
        SetupCategoryExists(categoryId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Leaky faucet in kitchen",
            categoryId,
            "Assigned");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedWorkOrders.Should().HaveCount(1);
        var workOrder = _addedWorkOrders[0];
        workOrder.PropertyId.Should().Be(propertyId);
        workOrder.Description.Should().Be("Leaky faucet in kitchen");
        workOrder.CategoryId.Should().Be(categoryId);
        workOrder.Status.Should().Be(WorkOrderStatus.Assigned);
        workOrder.AccountId.Should().Be(_testAccountId);
        workOrder.CreatedByUserId.Should().Be(_testUserId);
    }

    [Fact]
    public async Task Handle_MinimalCommand_CreatesWorkOrderWithDefaults()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null, // No category
            null); // Default status

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedWorkOrders.Should().HaveCount(1);
        var workOrder = _addedWorkOrders[0];
        workOrder.PropertyId.Should().Be(propertyId);
        workOrder.Description.Should().Be("Fix the door");
        workOrder.CategoryId.Should().BeNull();
        workOrder.Status.Should().Be(WorkOrderStatus.Reported); // Default status
    }

    [Fact]
    public async Task Handle_PropertyNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyNotFound();

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Property*{propertyId}*");
    }

    [Fact]
    public async Task Handle_CategoryNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);
        SetupCategoryNotFound();

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            categoryId,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*ExpenseCategory*{categoryId}*");
    }

    [Fact]
    public async Task Handle_OtherAccountProperty_ThrowsNotFoundException()
    {
        // Arrange - Property exists but belongs to other account
        // The global query filter simulates this by returning no results
        var propertyId = Guid.NewGuid();
        SetupPropertyNotFound(); // Simulates filter blocking other account's property

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null,
            null);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ValidCommand_SetsAccountIdFromCurrentUser()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedWorkOrders.Should().HaveCount(1);
        _addedWorkOrders[0].AccountId.Should().Be(_testAccountId);
        _addedWorkOrders[0].CreatedByUserId.Should().Be(_testUserId);
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsWorkOrderId()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null,
            null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedWorkOrders.Should().HaveCount(1);
        result.Should().Be(_addedWorkOrders[0].Id);
    }

    [Fact]
    public async Task Handle_ValidCommand_CallsSaveChanges()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _dbContextMock.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("reported", WorkOrderStatus.Reported)]
    [InlineData("REPORTED", WorkOrderStatus.Reported)]
    [InlineData("Reported", WorkOrderStatus.Reported)]
    [InlineData("assigned", WorkOrderStatus.Assigned)]
    [InlineData("ASSIGNED", WorkOrderStatus.Assigned)]
    [InlineData("completed", WorkOrderStatus.Completed)]
    [InlineData("COMPLETED", WorkOrderStatus.Completed)]
    public async Task Handle_StatusParsing_IsCaseInsensitive(string statusInput, WorkOrderStatus expectedStatus)
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "Fix the door",
            null,
            statusInput);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedWorkOrders.Should().HaveCount(1);
        _addedWorkOrders[0].Status.Should().Be(expectedStatus);
    }

    [Fact]
    public async Task Handle_DescriptionWithWhitespace_TrimsDescription()
    {
        // Arrange
        var propertyId = Guid.NewGuid();
        SetupPropertyExists(propertyId, _testAccountId);

        var command = new CreateWorkOrderCommand(
            propertyId,
            "  Fix the door  ",
            null,
            null);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _addedWorkOrders.Should().HaveCount(1);
        _addedWorkOrders[0].Description.Should().Be("Fix the door");
    }

    private void SetupPropertyExists(Guid propertyId, Guid accountId)
    {
        var properties = new List<Property>
        {
            new Property { Id = propertyId, AccountId = accountId, Name = "Test Property" }
        };
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private void SetupPropertyNotFound()
    {
        var properties = new List<Property>();
        var mockDbSet = properties.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.Properties).Returns(mockDbSet.Object);
    }

    private void SetupCategoryExists(Guid categoryId)
    {
        var categories = new List<ExpenseCategory>
        {
            new ExpenseCategory { Id = categoryId, Name = "Repairs" }
        };
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }

    private void SetupCategoryNotFound()
    {
        var categories = new List<ExpenseCategory>();
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }
}
