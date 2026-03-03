using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.Vendors;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for CreateVendorValidator (Story 17.8).
/// </summary>
public class CreateVendorValidatorTests
{
    private readonly CreateVendorValidator _validator = new();

    private static CreateVendorCommand CreateCommand(
        string firstName = "John",
        string? middleName = null,
        string lastName = "Doe",
        List<PhoneNumberDto>? phones = null,
        List<string>? emails = null,
        List<Guid>? tradeTagIds = null)
    {
        return new CreateVendorCommand(
            firstName,
            middleName,
            lastName,
            phones ?? new List<PhoneNumberDto>(),
            emails ?? new List<string>(),
            tradeTagIds ?? new List<Guid>());
    }

    [Fact]
    public void Validate_ValidCommand_NoErrors()
    {
        var command = CreateCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithMiddleName_NoErrors()
    {
        var command = CreateCommand(middleName: "Allen");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyFirstName_HasError(string? firstName)
    {
        var command = CreateCommand(firstName: firstName!);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name is required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_EmptyLastName_HasError(string? lastName)
    {
        var command = CreateCommand(lastName: lastName!);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name is required");
    }

    [Fact]
    public void Validate_FirstNameTooLong_HasError()
    {
        var command = CreateCommand(firstName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name must be 100 characters or less");
    }

    [Fact]
    public void Validate_LastNameTooLong_HasError()
    {
        var command = CreateCommand(lastName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name must be 100 characters or less");
    }

    [Fact]
    public void Validate_MiddleNameTooLong_HasError()
    {
        var command = CreateCommand(middleName: new string('A', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.MiddleName)
            .WithErrorMessage("Middle name must be 100 characters or less");
    }

    [Fact]
    public void Validate_FirstNameMaxLength_NoError()
    {
        var command = CreateCommand(firstName: new string('A', 100));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void Validate_LastNameMaxLength_NoError()
    {
        var command = CreateCommand(lastName: new string('A', 100));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void Validate_MiddleNameMaxLength_NoError()
    {
        var command = CreateCommand(middleName: new string('A', 100));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.MiddleName);
    }

    [Fact]
    public void Validate_NullMiddleName_NoError()
    {
        var command = CreateCommand(middleName: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.MiddleName);
    }

    // ─────────────────────────────────────────────────────────────────
    // Phone validation tests (Story 17.8 Task 2)
    // ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_PhoneNumberRequired_ReturnsError()
    {
        var command = CreateCommand(phones: new List<PhoneNumberDto>
        {
            new("", null)
        });
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Phones[0].Number")
            .WithErrorMessage("Phone number is required");
    }

    [Fact]
    public void Validate_PhoneNumberMaxLength_ReturnsError()
    {
        var command = CreateCommand(phones: new List<PhoneNumberDto>
        {
            new(new string('1', 51), null)
        });
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Phones[0].Number")
            .WithErrorMessage("Phone number must be 50 characters or less");
    }

    [Fact]
    public void Validate_PhoneLabelMaxLength_ReturnsError()
    {
        var command = CreateCommand(phones: new List<PhoneNumberDto>
        {
            new("512-555-1234", new string('A', 51))
        });
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Phones[0].Label")
            .WithErrorMessage("Phone label must be 50 characters or less");
    }

    [Fact]
    public void Validate_ValidPhone_NoError()
    {
        var command = CreateCommand(phones: new List<PhoneNumberDto>
        {
            new("512-555-1234", "Mobile")
        });
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // ─────────────────────────────────────────────────────────────────
    // Email validation tests (Story 17.8 Task 2)
    // ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Validate_EmailRequired_ReturnsError()
    {
        var command = CreateCommand(emails: new List<string> { "" });
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Emails[0]")
            .WithErrorMessage("Email address is required");
    }

    [Fact]
    public void Validate_EmailMaxLength_ReturnsError()
    {
        var command = CreateCommand(emails: new List<string> { new string('a', 256) });
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Emails[0]");
    }

    [Fact]
    public void Validate_EmailInvalidFormat_ReturnsError()
    {
        var command = CreateCommand(emails: new List<string> { "not-an-email" });
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Emails[0]")
            .WithErrorMessage("Invalid email address format");
    }

    [Fact]
    public void Validate_ValidEmail_NoError()
    {
        var command = CreateCommand(emails: new List<string> { "vendor@example.com" });
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
