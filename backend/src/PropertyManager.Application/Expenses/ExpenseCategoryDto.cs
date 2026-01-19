namespace PropertyManager.Application.Expenses;

/// <summary>
/// DTO for expense category data (AC-3.1.4).
/// Includes ParentId for hierarchy support (AC-9.1.9).
/// </summary>
public record ExpenseCategoryDto(
    Guid Id,
    string Name,
    string? ScheduleELine,
    int SortOrder,
    Guid? ParentId
);
