namespace PropertyManager.Application.Reports;

/// <summary>
/// Data transfer object containing all data needed for Schedule E PDF generation.
/// </summary>
/// <param name="PropertyId">Unique identifier of the property.</param>
/// <param name="PropertyName">Display name of the property.</param>
/// <param name="PropertyAddress">Full street address of the property.</param>
/// <param name="TaxYear">Tax year for the report.</param>
/// <param name="TotalIncome">Sum of all rental income for the year.</param>
/// <param name="ExpensesByCategory">Expenses grouped by Schedule E category line.</param>
/// <param name="TotalExpenses">Sum of all expenses for the year.</param>
/// <param name="NetIncome">Net income (TotalIncome - TotalExpenses).</param>
/// <param name="GeneratedAt">Timestamp when the report was generated.</param>
public record ScheduleEReportDto(
    Guid PropertyId,
    string PropertyName,
    string PropertyAddress,
    int TaxYear,
    decimal TotalIncome,
    List<ScheduleELineItemDto> ExpensesByCategory,
    decimal TotalExpenses,
    decimal NetIncome,
    DateTime GeneratedAt
);

/// <summary>
/// Represents a single expense category line item on Schedule E.
/// </summary>
/// <param name="LineNumber">IRS Schedule E line number (5-19).</param>
/// <param name="CategoryName">Display name of the expense category.</param>
/// <param name="Amount">Total amount for this category.</param>
public record ScheduleELineItemDto(
    int LineNumber,
    string CategoryName,
    decimal Amount
);
