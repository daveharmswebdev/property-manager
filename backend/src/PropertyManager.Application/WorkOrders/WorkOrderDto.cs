namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// DTO for work order display with related entity names.
/// </summary>
public record WorkOrderDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    Guid? VendorId,
    string? VendorName,
    bool IsDiy,
    Guid? CategoryId,
    string? CategoryName,
    string Status,
    string Description,
    DateTime CreatedAt,
    Guid CreatedByUserId,
    IReadOnlyList<WorkOrderTagDto> Tags
);
