namespace PropertyManager.Application.WorkOrders;

/// <summary>
/// DTO for work order tag display.
/// </summary>
public record WorkOrderTagDto(
    Guid Id,
    string Name
);
