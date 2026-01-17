using PropertyManager.Application.VendorTradeTags;

namespace PropertyManager.Application.Vendors;

/// <summary>
/// DTO for phone number display in vendor details.
/// </summary>
public record PhoneNumberDto(string Number, string? Label);

/// <summary>
/// DTO for full vendor details including phones, emails, and trade tags.
/// </summary>
public record VendorDetailDto(
    Guid Id,
    string FirstName,
    string? MiddleName,
    string LastName,
    string FullName,
    IReadOnlyList<PhoneNumberDto> Phones,
    IReadOnlyList<string> Emails,
    IReadOnlyList<VendorTradeTagDto> TradeTags
);
