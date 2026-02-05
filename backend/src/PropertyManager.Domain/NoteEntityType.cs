namespace PropertyManager.Domain;

/// <summary>
/// Defines valid entity types for polymorphic notes.
/// Using static class with constants (per ADR-16) for type safety without enum ordinal storage concerns.
/// </summary>
public static class NoteEntityType
{
    public const string WorkOrder = "WorkOrder";
    public const string Vendor = "Vendor";
    public const string Property = "Property";

    public static readonly string[] ValidTypes = { WorkOrder, Vendor, Property };

    public static bool IsValid(string type) => ValidTypes.Contains(type);
}
