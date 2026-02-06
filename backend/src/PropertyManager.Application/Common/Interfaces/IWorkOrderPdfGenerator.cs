using PropertyManager.Application.WorkOrders;

namespace PropertyManager.Application.Common.Interfaces;

/// <summary>
/// Interface for generating Work Order PDF reports.
/// Implementation in Infrastructure layer using QuestPDF.
/// </summary>
public interface IWorkOrderPdfGenerator
{
    /// <summary>
    /// Generates a Work Order PDF report.
    /// </summary>
    /// <param name="report">The report data containing work order details.</param>
    /// <returns>PDF document as byte array.</returns>
    byte[] Generate(WorkOrderPdfReportDto report);
}
