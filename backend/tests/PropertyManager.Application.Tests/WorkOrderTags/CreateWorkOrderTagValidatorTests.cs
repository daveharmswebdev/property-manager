using FluentAssertions;
using PropertyManager.Application.WorkOrderTags;

namespace PropertyManager.Application.Tests.WorkOrderTags;

/// <summary>
/// Unit tests for CreateWorkOrderTagValidator (AC #4).
/// </summary>
public class CreateWorkOrderTagValidatorTests
{
    private readonly CreateWorkOrderTagValidator _validator = new();

    [Fact]
    public async Task Validate_ValidName_Succeeds()
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand("Urgent");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Validate_EmptyOrNullName_Fails(string? name)
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand(name!);

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name");
    }

    [Fact]
    public async Task Validate_NameTooLong_Fails()
    {
        // Arrange
        var longName = new string('A', 101); // 101 characters, exceeds max of 100
        var command = new CreateWorkOrderTagCommand(longName);

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name" && e.ErrorMessage.Contains("100"));
    }

    [Fact]
    public async Task Validate_NameExactly100Chars_Succeeds()
    {
        // Arrange
        var exactName = new string('A', 100); // Exactly 100 characters
        var command = new CreateWorkOrderTagCommand(exactName);

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("Urgent")]
    [InlineData("Warranty Work")]
    [InlineData("Appliance Repair")]
    [InlineData("Follow-Up Needed")]
    public async Task Validate_ValidNames_Succeed(string name)
    {
        // Arrange
        var command = new CreateWorkOrderTagCommand(name);

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
