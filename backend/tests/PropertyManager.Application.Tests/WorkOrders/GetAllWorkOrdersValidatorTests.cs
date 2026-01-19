using FluentAssertions;
using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Application.Tests.WorkOrders;

/// <summary>
/// Unit tests for GetAllWorkOrdersValidator.
/// </summary>
public class GetAllWorkOrdersValidatorTests
{
    private readonly GetAllWorkOrdersValidator _validator;

    public GetAllWorkOrdersValidatorTests()
    {
        _validator = new GetAllWorkOrdersValidator();
    }

    [Fact]
    public async Task Validate_NullStatus_IsValid()
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: null);

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_EmptyStatus_IsValid()
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: "");

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_WhitespaceStatus_IsValid()
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: "   ");

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("Reported")]
    [InlineData("Assigned")]
    [InlineData("Completed")]
    public async Task Validate_ValidStatus_IsValid(string status)
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: status);

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("reported")]
    [InlineData("ASSIGNED")]
    [InlineData("completed")]
    [InlineData("rEpOrTeD")]
    public async Task Validate_ValidStatusCaseInsensitive_IsValid(string status)
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: status);

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("InvalidStatus")]
    [InlineData("Pending")]
    [InlineData("InProgress")]
    [InlineData("Cancelled")]
    [InlineData("123")]
    public async Task Validate_InvalidStatus_IsInvalid(string status)
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: status);

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle();
        result.Errors[0].PropertyName.Should().Be("Status");
        result.Errors[0].ErrorMessage.Should().Contain("Reported");
        result.Errors[0].ErrorMessage.Should().Contain("Assigned");
        result.Errors[0].ErrorMessage.Should().Contain("Completed");
    }

    [Fact]
    public async Task Validate_ValidPropertyId_IsValid()
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(PropertyId: Guid.NewGuid());

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_NullPropertyId_IsValid()
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(PropertyId: null);

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_BothFiltersValid_IsValid()
    {
        // Arrange
        var query = new GetAllWorkOrdersQuery(Status: "Assigned", PropertyId: Guid.NewGuid());

        // Act
        var result = await _validator.ValidateAsync(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
