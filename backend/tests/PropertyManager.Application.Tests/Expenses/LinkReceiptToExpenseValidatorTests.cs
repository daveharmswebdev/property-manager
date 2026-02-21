using FluentAssertions;
using PropertyManager.Application.Expenses;

namespace PropertyManager.Application.Tests.Expenses;

/// <summary>
/// Unit tests for LinkReceiptToExpenseValidator (Story 16.4, AC3).
/// Tests FAIL until LinkReceiptToExpenseValidator.cs is created.
/// </summary>
public class LinkReceiptToExpenseValidatorTests
{
    private readonly LinkReceiptToExpenseValidator _validator;

    public LinkReceiptToExpenseValidatorTests()
    {
        _validator = new LinkReceiptToExpenseValidator();
    }

    [Fact]
    public async Task Validate_EmptyExpenseId_Fails()
    {
        // Arrange
        var command = new LinkReceiptToExpenseCommand(Guid.Empty, Guid.NewGuid());

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ExpenseId");
    }

    [Fact]
    public async Task Validate_EmptyReceiptId_Fails()
    {
        // Arrange
        var command = new LinkReceiptToExpenseCommand(Guid.NewGuid(), Guid.Empty);

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ReceiptId");
    }

    [Fact]
    public async Task Validate_ValidCommand_Passes()
    {
        // Arrange
        var command = new LinkReceiptToExpenseCommand(Guid.NewGuid(), Guid.NewGuid());

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
