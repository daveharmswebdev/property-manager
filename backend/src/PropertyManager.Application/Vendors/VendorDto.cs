namespace PropertyManager.Application.Vendors;

/// <summary>
/// DTO for vendor list display.
/// </summary>
public record VendorDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName
);
