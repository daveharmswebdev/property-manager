using PropertyManager.Application.VendorTradeTags;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// DTO for vendor list display with enhanced details.
/// </summary>
public record VendorDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    IReadOnlyList<PhoneNumberDto> Phones,
    IReadOnlyList<string> Emails,
    IReadOnlyList<VendorTradeTagDto> TradeTags
);
