using PropertyManager.Application.MaintenanceRequestPhotos;

namespace PropertyManager.Application.MaintenanceRequests;

/// <summary>
/// DTO for maintenance request display with related entity info.
/// </summary>
public record MaintenanceRequestDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    string PropertyAddress,
    string Description,
    string Status,
    string? DismissalReason,
    Guid SubmittedByUserId,
    string? SubmittedByUserName,
    Guid? WorkOrderId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<MaintenanceRequestPhotoDto>? Photos = null
);
