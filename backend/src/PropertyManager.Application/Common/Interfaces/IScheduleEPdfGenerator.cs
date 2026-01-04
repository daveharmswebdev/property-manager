using PropertyManager.Application.Reports;

namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for generating Schedule E PDF reports.
/// Implementation in Infrastructure layer using QuestPDF.
/// </summary>
public interface IScheduleEPdfGenerator
{
    /// <summary>
    /// Generates a Schedule E PDF report for a property.
    /// </summary>
    /// <param name="report">The report data containing property, income, and expense information.</param>
    /// <returns>PDF document as byte array.</returns>
    byte[] Generate(ScheduleEReportDto report);
}
