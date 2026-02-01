namespace PropertyManager.Application.Common;

/// <summary>
/// Utility class for sanitizing user-controlled input before logging
/// to prevent log forging/injection attacks.
/// </summary>
public static class LogSanitizer
{
    /// <summary>
    /// Sanitizes a string value for safe logging by removing newline and carriage return characters.
    /// Prevents log forging attacks where attackers inject newlines to create fake log entries.
    /// </summary>
    /// <param name="value">The user-controlled string to sanitize</param>
    /// <returns>Sanitized string safe for logging</returns>
    public static string Sanitize(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value
            .Replace("\r", string.Empty)
            .Replace("\n", string.Empty)
            .Replace("\t", " ");
    }

    /// <summary>
    /// Masks an email address for logging to avoid exposing full PII.
    /// Example: "user@example.com" becomes "u***@e***.com"
    /// </summary>
    /// <param name="email">The email address to mask</param>
    /// <returns>Masked email safe for logging</returns>
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrEmpty(email))
        {
            return string.Empty;
        }

        var sanitized = Sanitize(email);
        var atIndex = sanitized.IndexOf('@');

        if (atIndex <= 0)
        {
            return sanitized.Length > 2
                ? sanitized[0] + "***"
                : "***";
        }

        var localPart = sanitized[..atIndex];
        var domainPart = sanitized[(atIndex + 1)..];

        var maskedLocal = localPart.Length > 1
            ? localPart[0] + "***"
            : "***";

        var dotIndex = domainPart.LastIndexOf('.');
        string maskedDomain;

        if (dotIndex > 0)
        {
            var domainName = domainPart[..dotIndex];
            var tld = domainPart[dotIndex..];
            maskedDomain = (domainName.Length > 1 ? domainName[0] + "***" : "***") + tld;
        }
        else
        {
            maskedDomain = domainPart.Length > 1 ? domainPart[0] + "***" : "***";
        }

        return $"{maskedLocal}@{maskedDomain}";
    }

    /// <summary>
    /// Masks a sensitive identifier (like accountId, userId) for logging.
    /// Shows only first 8 characters of GUID.
    /// Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" becomes "a1b2c3d4-****"
    /// </summary>
    /// <param name="id">The identifier to mask</param>
    /// <returns>Masked identifier safe for logging</returns>
    public static string MaskId(string? id)
    {
        if (string.IsNullOrEmpty(id))
        {
            return string.Empty;
        }

        var sanitized = Sanitize(id);
        return sanitized.Length > 8
            ? sanitized[..8] + "-****"
            : sanitized;
    }

    /// <summary>
    /// Masks a sensitive identifier (like accountId, userId) for logging.
    /// </summary>
    /// <param name="id">The GUID to mask</param>
    /// <returns>Masked identifier safe for logging</returns>
    public static string MaskId(Guid id)
    {
        return MaskId(id.ToString());
    }

    /// <summary>
    /// Masks a storage key for logging.
    /// Storage keys often contain accountIds in the path.
    /// Format: "accountId/entityType/year/fileId.ext" becomes "****-****/entityType/year/fileId.ext"
    /// </summary>
    /// <param name="storageKey">The storage key to mask</param>
    /// <returns>Masked storage key safe for logging</returns>
    public static string MaskStorageKey(string? storageKey)
    {
        if (string.IsNullOrEmpty(storageKey))
        {
            return string.Empty;
        }

        var sanitized = Sanitize(storageKey);
        var firstSlash = sanitized.IndexOf('/');

        if (firstSlash > 0)
        {
            // Mask the first segment (likely accountId)
            var rest = sanitized[(firstSlash)..];
            return MaskId(sanitized[..firstSlash]) + rest;
        }

        return sanitized;
    }
}
