using FluentAssertions;
using MockQueryable.Moq;
using Moq;
using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Expenses;
using PropertyManager.Domain.Entities;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for GetExpenseCategoriesQueryHandler (AC #9 ParentId).
/// </summary>
public class GetExpenseCategoriesHandlerTests
{
    private readonly Mock<IAppDbContext> _dbContextMock;
    private readonly GetExpenseCategoriesQueryHandler _handler;

    public GetExpenseCategoriesHandlerTests()
    {
        _dbContextMock = new Mock<IAppDbContext>();
        _handler = new GetExpenseCategoriesQueryHandler(_dbContextMock.Object);
    }

    [Fact]
    public async Task Handle_ReturnsParentIdInDto()
    {
        // Arrange
        var parentCategory = new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            Name = "Repairs",
            ScheduleELine = "Line 14",
            SortOrder = 1,
            ParentId = null
        };
        var childCategory = new ExpenseCategory
        {
            Id = Guid.NewGuid(),
            Name = "Plumbing Repairs",
            ScheduleELine = null,
            SortOrder = 2,
            ParentId = parentCategory.Id
        };

        var categories = new List<ExpenseCategory> { parentCategory, childCategory };
        SetupExpenseCategoriesDbSet(categories);
        var query = new GetExpenseCategoriesQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(2);

        var parentDto = result.First(c => c.Name == "Repairs");
        parentDto.ParentId.Should().BeNull();

        var childDto = result.First(c => c.Name == "Plumbing Repairs");
        childDto.ParentId.Should().Be(parentCategory.Id);
    }

    [Fact]
    public async Task Handle_TopLevelCategoriesHaveNullParentId()
    {
        // Arrange
        var categories = new List<ExpenseCategory>
        {
            new ExpenseCategory
            {
                Id = Guid.NewGuid(),
                Name = "Advertising",
                ScheduleELine = "Line 5",
                SortOrder = 1,
                ParentId = null
            },
            new ExpenseCategory
            {
                Id = Guid.NewGuid(),
                Name = "Insurance",
                ScheduleELine = "Line 9",
                SortOrder = 2,
                ParentId = null
            }
        };
        SetupExpenseCategoriesDbSet(categories);
        var query = new GetExpenseCategoriesQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(c => c.ParentId == null);
    }

    [Fact]
    public async Task Handle_CategoriesReturnedSortedBySortOrder()
    {
        // Arrange
        var categories = new List<ExpenseCategory>
        {
            new ExpenseCategory { Id = Guid.NewGuid(), Name = "Third", SortOrder = 3 },
            new ExpenseCategory { Id = Guid.NewGuid(), Name = "First", SortOrder = 1 },
            new ExpenseCategory { Id = Guid.NewGuid(), Name = "Second", SortOrder = 2 }
        };
        SetupExpenseCategoriesDbSet(categories);
        var query = new GetExpenseCategoriesQuery();

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().HaveCount(3);
        result[0].Name.Should().Be("First");
        result[1].Name.Should().Be("Second");
        result[2].Name.Should().Be("Third");
    }

    private void SetupExpenseCategoriesDbSet(List<ExpenseCategory> categories)
    {
        var mockDbSet = categories.AsQueryable().BuildMockDbSet();
        _dbContextMock.Setup(x => x.ExpenseCategories).Returns(mockDbSet.Object);
    }
}
