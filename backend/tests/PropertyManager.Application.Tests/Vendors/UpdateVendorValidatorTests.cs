using FluentAssertions;
using FluentValidation.TestHelper;
using PropertyManager.Application.Vendors;

namespace PropertyManager.Application.Tests.Vendors;

/// <summary>
/// Unit tests for UpdateVendorValidator (AC #13).
/// </summary>
public class UpdateVendorValidatorTests
{
    private readonly UpdateVendorValidator _validator = new();

    [Fact]
    public void ValidCommand_PassesValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            "Michael",
            "Doe",
            new List<PhoneNumberDto>
            {
                new("512-555-1234", "Mobile")
            },
            new List<string> { "john@example.com" },
            new List<Guid> { Guid.NewGuid() }
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyId_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.Empty,
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Vendor ID is required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyFirstName_FailsValidation(string? firstName)
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            firstName!,
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name is required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyLastName_FailsValidation(string? lastName)
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            lastName!,
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name is required");
    }

    [Fact]
    public void FirstNameTooLong_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            new string('a', 101),
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name must be 100 characters or less");
    }

    [Fact]
    public void LastNameTooLong_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            new string('a', 101),
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name must be 100 characters or less");
    }

    [Fact]
    public void MiddleNameTooLong_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            new string('a', 101),
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.MiddleName)
            .WithErrorMessage("Middle name must be 100 characters or less");
    }

    [Fact]
    public void PhoneNumberEmpty_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>
            {
                new("", "Mobile")
            },
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Phones[0].Number")
            .WithErrorMessage("Phone number is required");
    }

    [Fact]
    public void PhoneNumberTooLong_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>
            {
                new(new string('1', 51), "Mobile")
            },
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Phones[0].Number")
            .WithErrorMessage("Phone number must be 50 characters or less");
    }

    [Fact]
    public void PhoneLabelTooLong_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>
            {
                new("512-555-1234", new string('a', 51))
            },
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Phones[0].Label")
            .WithErrorMessage("Phone label must be 50 characters or less");
    }

    [Fact]
    public void EmailEmpty_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string> { "" },
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Emails[0]")
            .WithErrorMessage("Email address is required");
    }

    [Fact]
    public void EmailTooLong_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string> { new string('a', 256) },
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Emails[0]")
            .WithErrorMessage("Email must be 255 characters or less");
    }

    [Fact]
    public void InvalidEmailFormat_FailsValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string> { "not-an-email" },
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Emails[0]")
            .WithErrorMessage("Invalid email address format");
    }

    [Fact]
    public void MultiplePhones_AllValidated()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>
            {
                new("512-555-1234", "Mobile"),
                new("", "Office"),  // Invalid
                new("512-555-5678", "Home")
            },
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Phones[1].Number");
        result.Errors.Should().HaveCount(1);
    }

    [Fact]
    public void MultipleEmails_AllValidated()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>
            {
                "valid@example.com",
                "invalid-email",
                "also-valid@example.com"
            },
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor("Emails[1]");
        result.Errors.Should().HaveCount(1);
    }

    [Fact]
    public void NullPhoneLabel_PassesValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>
            {
                new("512-555-1234", null)
            },
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyLists_PassesValidation()
    {
        // Arrange
        var command = new UpdateVendorCommand(
            Guid.NewGuid(),
            "John",
            null,
            "Doe",
            new List<PhoneNumberDto>(),
            new List<string>(),
            new List<Guid>()
        );

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
