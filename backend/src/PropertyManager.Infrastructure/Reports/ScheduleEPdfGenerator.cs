using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.Reports;
using QuestPDF.Fluent;
using static PropertyManager.Application.Reports.ScheduleECategoryMapping;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PropertyManager.Infrastructure.Reports;

/// <summary>
/// Generates Schedule E PDF reports using QuestPDF.
/// </summary>
public class ScheduleEPdfGenerator : IScheduleEPdfGenerator
{
    public byte[] Generate(ScheduleEReportDto report)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(50);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Element(ComposeHeader);
                page.Content().Element(c => ComposeContent(c, report));
                page.Footer().Element(c => ComposeFooter(c, report));
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().Text("Schedule E Worksheet")
                .FontSize(18).Bold().FontColor(Colors.Green.Darken2);
            column.Item().Text("Supplemental Income and Loss")
                .FontSize(12).Italic();
            column.Item().PaddingBottom(10).LineHorizontal(1);
        });
    }

    private void ComposeContent(IContainer container, ScheduleEReportDto report)
    {
        container.Column(column =>
        {
            // Property Information
            column.Item().Text($"Property: {report.PropertyName}").Bold();
            column.Item().Text($"Address: {report.PropertyAddress}");
            column.Item().Text($"Tax Year: {report.TaxYear}");
            column.Item().PaddingVertical(10).LineHorizontal(0.5f);

            // Income Section
            column.Item().PaddingTop(10).Text("INCOME").Bold().FontSize(12);
            column.Item().Row(row =>
            {
                row.RelativeItem().Text("Rents received");
                row.ConstantItem(100).AlignRight().Text(FormatCurrency(report.TotalIncome));
            });
            column.Item().PaddingVertical(10).LineHorizontal(0.5f);

            // Expenses Section
            column.Item().PaddingTop(10).Text("EXPENSES").Bold().FontSize(12);

            // All 15 Schedule E lines
            foreach (var line in GetAllScheduleELines(report.ExpensesByCategory))
            {
                column.Item().Row(row =>
                {
                    row.ConstantItem(30).Text($"{line.LineNumber}.");
                    row.RelativeItem().Text(line.CategoryName);
                    row.ConstantItem(100).AlignRight().Text(FormatCurrency(line.Amount));
                });
            }

            column.Item().PaddingVertical(5).LineHorizontal(0.5f);
            column.Item().Row(row =>
            {
                row.RelativeItem().Text("Total Expenses").Bold();
                row.ConstantItem(100).AlignRight().Text(FormatCurrency(report.TotalExpenses)).Bold();
            });

            // Net Income
            column.Item().PaddingVertical(10).LineHorizontal(1);
            column.Item().Row(row =>
            {
                row.RelativeItem().Text("NET INCOME (LOSS)").Bold().FontSize(12);
                row.ConstantItem(100).AlignRight()
                    .Text(FormatCurrency(report.NetIncome))
                    .Bold()
                    .FontColor(report.NetIncome >= 0 ? Colors.Green.Darken2 : Colors.Red.Medium);
            });
        });
    }

    private void ComposeFooter(IContainer container, ScheduleEReportDto report)
    {
        container.Column(column =>
        {
            column.Item().LineHorizontal(0.5f);
            column.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Text($"Generated: {report.GeneratedAt:MMM dd, yyyy}")
                    .FontSize(8).FontColor(Colors.Grey.Medium);
                row.RelativeItem().AlignRight().Text("Property Manager")
                    .FontSize(8).FontColor(Colors.Grey.Medium);
            });
        });
    }

    private static IEnumerable<ScheduleELineItemDto> GetAllScheduleELines(List<ScheduleELineItemDto> reported)
    {
        // Return all 15 lines, summing amounts if multiple categories map to the same line
        var allLines = ScheduleECategoryMapping.CategoryToLine
            .Select(kvp =>
            {
                var totalAmount = reported
                    .Where(r => r.LineNumber == kvp.Value)
                    .Sum(r => r.Amount);

                return new ScheduleELineItemDto(
                    kvp.Value,
                    kvp.Key,
                    totalAmount
                );
            })
            .OrderBy(l => l.LineNumber);

        return allLines;
    }

    private static string FormatCurrency(decimal amount)
    {
        return amount.ToString("$#,##0.00");
    }
}
