namespace PropertyManager.Domain.ValueObjects;

/// <summary>
/// Value object representing a phone number with optional label.
/// Used in Person entity for multiple contact numbers.
/// </summary>
/// <param name="Number">The phone number string</param>
/// <param name="Label">Optional label (e.g., "Mobile", "Work", "Home")</param>
public record PhoneNumber(string Number, string? Label);
