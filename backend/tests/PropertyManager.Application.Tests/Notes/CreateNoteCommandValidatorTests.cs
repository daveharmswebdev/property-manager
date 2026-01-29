using FluentAssertions;
using PropertyManager.Application.Notes;

namespace PropertyManager.Application.Tests.Notes;

/// <summary>
/// Unit tests for CreateNoteCommandValidator (AC #7).
/// Tests validation for content and entity type.
/// </summary>
public class CreateNoteCommandValidatorTests
{
    private readonly CreateNoteCommandValidator _validator;

    public CreateNoteCommandValidatorTests()
    {
        _validator = new CreateNoteCommandValidator();
    }

    [Fact]
    public async Task Validate_ValidCommand_PassesValidation()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "Valid content");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_EmptyContent_ReturnsError()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Content" && e.ErrorMessage.Contains("required"));
    }

    [Fact]
    public async Task Validate_WhitespaceContent_ReturnsError()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.NewGuid(), "   ");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Content");
    }

    [Fact]
    public async Task Validate_InvalidEntityType_ReturnsError()
    {
        // Arrange
        var command = new CreateNoteCommand("InvalidType", Guid.NewGuid(), "Valid content");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == "EntityType" &&
            e.ErrorMessage.Contains("must be one of"));
    }

    [Fact]
    public async Task Validate_EmptyEntityType_ReturnsError()
    {
        // Arrange
        var command = new CreateNoteCommand("", Guid.NewGuid(), "Valid content");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "EntityType");
    }

    [Fact]
    public async Task Validate_EmptyEntityId_ReturnsError()
    {
        // Arrange
        var command = new CreateNoteCommand("WorkOrder", Guid.Empty, "Valid content");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "EntityId");
    }

    [Theory]
    [InlineData("WorkOrder")]
    [InlineData("Vendor")]
    [InlineData("Property")]
    public async Task Validate_ValidEntityTypes_PassesValidation(string entityType)
    {
        // Arrange
        var command = new CreateNoteCommand(entityType, Guid.NewGuid(), "Valid content");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("workorder")] // lowercase
    [InlineData("WORKORDER")] // uppercase
    [InlineData("Work Order")] // space
    public async Task Validate_CaseSensitiveEntityType_ReturnsError(string entityType)
    {
        // Arrange
        var command = new CreateNoteCommand(entityType, Guid.NewGuid(), "Valid content");

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "EntityType");
    }
}
