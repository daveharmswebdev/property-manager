using PropertyManager.Domain.Common;
using PropertyManager.Domain.ValueObjects;

namespace PropertyManager.Domain.Entities;

/// <summary>
/// Base entity for all person types (Vendor, future Tenant, etc.).
/// Implements TPT inheritance pattern - stored in Persons table.
/// </summary>
public class Person : AuditableEntity, ITenantEntity
{
    public Guid AccountId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public List<PhoneNumber> Phones { get; set; } = new();
    public List<string> Emails { get; set; } = new();

    // Navigation properties
    public Account Account { get; set; } = null!;

    /// <summary>
    /// Full name formatted as "FirstName MiddleName LastName" or "FirstName LastName" if no middle name.
    /// </summary>
    public string FullName => string.IsNullOrWhiteSpace(MiddleName)
        ? $"{FirstName} {LastName}"
        : $"{FirstName} {MiddleName} {LastName}";
}
