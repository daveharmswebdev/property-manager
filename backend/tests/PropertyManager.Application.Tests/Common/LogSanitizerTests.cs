using PropertyManager.Application.Common;

namespace PropertyManager.Application.Tests.Common;

/// <summary>
/// Tests for LogSanitizer utility methods.
/// </summary>
public class LogSanitizerTests
{
    [Fact]
    public void Sanitize_WithNullInput_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.Sanitize(null);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void Sanitize_WithEmptyInput_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.Sanitize(string.Empty);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void Sanitize_WithCleanInput_ReturnsUnchanged()
    {
        // Arrange
        var input = "normal log message";

        // Act
        var result = LogSanitizer.Sanitize(input);

        // Assert
        Assert.Equal("normal log message", result);
    }

    [Fact]
    public void Sanitize_WithNewlines_RemovesNewlines()
    {
        // Arrange - Log forging attack: injecting fake log entries
        var maliciousInput = "User logged in\n[2024-01-01] ADMIN: Password changed for all users";

        // Act
        var result = LogSanitizer.Sanitize(maliciousInput);

        // Assert - Newline removed, single log entry
        Assert.Equal("User logged in[2024-01-01] ADMIN: Password changed for all users", result);
        Assert.DoesNotContain("\n", result);
    }

    [Fact]
    public void Sanitize_WithCarriageReturn_RemovesCarriageReturn()
    {
        // Arrange
        var input = "line1\rline2";

        // Act
        var result = LogSanitizer.Sanitize(input);

        // Assert
        Assert.Equal("line1line2", result);
        Assert.DoesNotContain("\r", result);
    }

    [Fact]
    public void Sanitize_WithWindowsLineEnding_RemovesBoth()
    {
        // Arrange
        var input = "line1\r\nline2";

        // Act
        var result = LogSanitizer.Sanitize(input);

        // Assert
        Assert.Equal("line1line2", result);
    }

    [Fact]
    public void Sanitize_WithTabs_ReplacesWithSpace()
    {
        // Arrange
        var input = "column1\tcolumn2";

        // Act
        var result = LogSanitizer.Sanitize(input);

        // Assert
        Assert.Equal("column1 column2", result);
    }

    [Fact]
    public void MaskEmail_WithNullInput_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.MaskEmail(null);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void MaskEmail_WithEmptyInput_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.MaskEmail(string.Empty);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void MaskEmail_WithValidEmail_MasksCorrectly()
    {
        // Arrange
        var email = "user@example.com";

        // Act
        var result = LogSanitizer.MaskEmail(email);

        // Assert - Shows first char of local and domain parts
        Assert.Equal("u***@e***.com", result);
    }

    [Fact]
    public void MaskEmail_WithLongEmail_MasksCorrectly()
    {
        // Arrange
        var email = "verylongusername@verylongdomain.org";

        // Act
        var result = LogSanitizer.MaskEmail(email);

        // Assert
        Assert.Equal("v***@v***.org", result);
    }

    [Fact]
    public void MaskEmail_WithSingleCharLocal_MasksCorrectly()
    {
        // Arrange
        var email = "a@example.com";

        // Act
        var result = LogSanitizer.MaskEmail(email);

        // Assert
        Assert.Equal("***@e***.com", result);
    }

    [Fact]
    public void MaskEmail_WithNoAtSign_ReturnsMasked()
    {
        // Arrange
        var input = "not-an-email";

        // Act
        var result = LogSanitizer.MaskEmail(input);

        // Assert
        Assert.Equal("n***", result);
    }

    [Fact]
    public void MaskId_WithNullString_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.MaskId((string?)null);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void MaskId_WithGuid_MasksCorrectly()
    {
        // Arrange
        var guid = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

        // Act
        var result = LogSanitizer.MaskId(guid);

        // Assert - Shows first 8 chars
        Assert.Equal("a1b2c3d4-****", result);
    }

    [Fact]
    public void MaskId_WithShortString_ReturnsUnchanged()
    {
        // Arrange
        var shortId = "abc";

        // Act
        var result = LogSanitizer.MaskId(shortId);

        // Assert
        Assert.Equal("abc", result);
    }

    [Fact]
    public void MaskStorageKey_WithNullInput_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.MaskStorageKey(null);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void MaskStorageKey_WithEmptyInput_ReturnsEmptyString()
    {
        // Arrange & Act
        var result = LogSanitizer.MaskStorageKey(string.Empty);

        // Assert
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void MaskStorageKey_WithAccountIdPath_MasksAccountId()
    {
        // Arrange - Typical storage key: accountId/entityType/year/fileId.ext
        var storageKey = "a1b2c3d4-e5f6-7890-abcd-ef1234567890/receipts/2024/file123.jpg";

        // Act
        var result = LogSanitizer.MaskStorageKey(storageKey);

        // Assert - Account ID portion masked
        Assert.StartsWith("a1b2c3d4-****", result);
        Assert.EndsWith("/receipts/2024/file123.jpg", result);
    }

    [Fact]
    public void MaskStorageKey_WithNoSlash_ReturnsUnchanged()
    {
        // Arrange
        var storageKey = "simple-key";

        // Act
        var result = LogSanitizer.MaskStorageKey(storageKey);

        // Assert
        Assert.Equal("simple-key", result);
    }
}
