using PropertyManager.Application.Common.Interfaces;
using PropertyManager.Application.WorkOrders;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PropertyManager.Infrastructure.Reports;

/// <summary>
/// Generates Work Order PDF reports using QuestPDF.
/// Follows ScheduleEPdfGenerator patterns per Dev Notes.
/// </summary>
public class WorkOrderPdfGenerator : IWorkOrderPdfGenerator
{
    public byte[] Generate(WorkOrderPdfReportDto report)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(50);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Element(c => ComposeHeader(c, report));
                page.Content().Element(c => ComposeContent(c, report));
                page.Footer().Element(ComposeFooter);
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, WorkOrderPdfReportDto report)
    {
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Work Order")
                        .FontSize(18).Bold().FontColor(Colors.Green.Darken2);
                    col.Item().Text($"ID: {report.ShortId}")
                        .FontSize(10).FontColor(Colors.Grey.Darken1);
                });

                row.ConstantItem(120).AlignRight().Column(col =>
                {
                    col.Item().AlignRight().Text($"Generated: {report.GeneratedDate:MMM dd, yyyy}")
                        .FontSize(8).FontColor(Colors.Grey.Medium);
                    col.Item().AlignRight().PaddingTop(4)
                        .Text(report.Status)
                        .FontSize(11).Bold().FontColor(GetStatusColor(report.Status));
                });
            });

            column.Item().PaddingBottom(10).LineHorizontal(1);
        });
    }

    private void ComposeContent(IContainer container, WorkOrderPdfReportDto report)
    {
        container.Column(column =>
        {
            // Property Information (AC #2)
            ComposePropertySection(column, report);

            // Work Order Details (AC #2)
            ComposeDetailsSection(column, report);

            // Assignment (AC #2)
            ComposeAssignmentSection(column, report);

            // Notes Section (AC #2)
            ComposeNotesSection(column, report);

            // Linked Expenses Section (AC #2)
            ComposeExpensesSection(column, report);

            // Photo count note (AC #3)
            if (report.PhotoCount > 0)
            {
                column.Item().PaddingTop(10).Text(
                    $"{report.PhotoCount} photo{(report.PhotoCount == 1 ? "" : "s")} attached - view online")
                    .Italic().FontColor(Colors.Grey.Darken1);
            }
        });
    }

    private void ComposePropertySection(ColumnDescriptor column, WorkOrderPdfReportDto report)
    {
        column.Item().PaddingTop(5).Text("PROPERTY INFORMATION").Bold().FontSize(11)
            .FontColor(Colors.Green.Darken2);

        column.Item().PaddingTop(4).Row(row =>
        {
            row.ConstantItem(100).Text("Property:").Bold();
            row.RelativeItem().Text(report.PropertyName);
        });

        column.Item().Row(row =>
        {
            row.ConstantItem(100).Text("Address:").Bold();
            row.RelativeItem().Text(report.PropertyAddress);
        });

        column.Item().PaddingVertical(8).LineHorizontal(0.5f);
    }

    private void ComposeDetailsSection(ColumnDescriptor column, WorkOrderPdfReportDto report)
    {
        column.Item().Text("WORK ORDER DETAILS").Bold().FontSize(11)
            .FontColor(Colors.Green.Darken2);

        column.Item().PaddingTop(4).Row(row =>
        {
            row.ConstantItem(100).Text("Description:").Bold();
            row.RelativeItem().Text(report.Description);
        });

        if (!string.IsNullOrEmpty(report.CategoryName))
        {
            column.Item().Row(row =>
            {
                row.ConstantItem(100).Text("Category:").Bold();
                row.RelativeItem().Text(report.CategoryName);
            });
        }

        if (!string.IsNullOrEmpty(report.Tags))
        {
            column.Item().Row(row =>
            {
                row.ConstantItem(100).Text("Tags:").Bold();
                row.RelativeItem().Text(report.Tags);
            });
        }

        column.Item().Row(row =>
        {
            row.ConstantItem(100).Text("Created:").Bold();
            row.RelativeItem().Text($"{report.CreatedDate:MMM dd, yyyy} by {report.CreatedByName}");
        });

        column.Item().PaddingVertical(8).LineHorizontal(0.5f);
    }

    private void ComposeAssignmentSection(ColumnDescriptor column, WorkOrderPdfReportDto report)
    {
        column.Item().Text("ASSIGNMENT").Bold().FontSize(11)
            .FontColor(Colors.Green.Darken2);

        if (report.IsDiy)
        {
            column.Item().PaddingTop(4).Text("Self (DIY)").Italic();
        }
        else if (report.Vendor != null)
        {
            column.Item().PaddingTop(4).Row(row =>
            {
                row.ConstantItem(100).Text("Vendor:").Bold();
                row.RelativeItem().Text(report.Vendor.Name);
            });

            if (!string.IsNullOrEmpty(report.Vendor.Phone))
            {
                column.Item().Row(row =>
                {
                    row.ConstantItem(100).Text("Phone:").Bold();
                    row.RelativeItem().Text(report.Vendor.Phone);
                });
            }

            if (!string.IsNullOrEmpty(report.Vendor.Email))
            {
                column.Item().Row(row =>
                {
                    row.ConstantItem(100).Text("Email:").Bold();
                    row.RelativeItem().Text(report.Vendor.Email);
                });
            }

            if (!string.IsNullOrEmpty(report.Vendor.TradeTags))
            {
                column.Item().Row(row =>
                {
                    row.ConstantItem(100).Text("Trades:").Bold();
                    row.RelativeItem().Text(report.Vendor.TradeTags);
                });
            }
        }

        column.Item().PaddingVertical(8).LineHorizontal(0.5f);
    }

    private void ComposeNotesSection(ColumnDescriptor column, WorkOrderPdfReportDto report)
    {
        column.Item().Text("NOTES").Bold().FontSize(11)
            .FontColor(Colors.Green.Darken2);

        if (report.Notes.Count == 0)
        {
            column.Item().PaddingTop(4).Text("No notes recorded").Italic()
                .FontColor(Colors.Grey.Darken1);
        }
        else
        {
            foreach (var note in report.Notes)
            {
                column.Item().PaddingTop(4).Column(noteCol =>
                {
                    noteCol.Item().Text(note.Content);
                    noteCol.Item().Text($"- {note.AuthorName}, {note.Timestamp:MMM dd, yyyy h:mm tt}")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);
                });
            }
        }

        column.Item().PaddingVertical(8).LineHorizontal(0.5f);
    }

    private void ComposeExpensesSection(ColumnDescriptor column, WorkOrderPdfReportDto report)
    {
        column.Item().Text("LINKED EXPENSES").Bold().FontSize(11)
            .FontColor(Colors.Green.Darken2);

        if (report.Expenses.Count == 0)
        {
            column.Item().PaddingTop(4).Text("No expenses linked").Italic()
                .FontColor(Colors.Grey.Darken1);
        }
        else
        {
            column.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(80);   // Date
                    columns.RelativeColumn();       // Description
                    columns.ConstantColumn(100);   // Category
                    columns.ConstantColumn(80);    // Amount
                });

                // Header row
                table.Header(header =>
                {
                    header.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten1)
                        .PaddingBottom(4).Text("Date").Bold().FontSize(9);
                    header.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten1)
                        .PaddingBottom(4).Text("Description").Bold().FontSize(9);
                    header.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten1)
                        .PaddingBottom(4).Text("Category").Bold().FontSize(9);
                    header.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten1)
                        .PaddingBottom(4).AlignRight().Text("Amount").Bold().FontSize(9);
                });

                // Data rows
                foreach (var expense in report.Expenses)
                {
                    table.Cell().PaddingVertical(2).Text(expense.Date.ToString("MM/dd/yyyy")).FontSize(9);
                    table.Cell().PaddingVertical(2).Text(expense.Description ?? "-").FontSize(9);
                    table.Cell().PaddingVertical(2).Text(expense.CategoryName).FontSize(9);
                    table.Cell().PaddingVertical(2).AlignRight()
                        .Text(expense.Amount.ToString("$#,##0.00")).FontSize(9);
                }

                // Total row
                var total = report.Expenses.Sum(e => e.Amount);
                table.Cell().ColumnSpan(3).BorderTop(1).BorderColor(Colors.Grey.Lighten1)
                    .PaddingTop(4).AlignRight().Text("Total:").Bold().FontSize(9);
                table.Cell().BorderTop(1).BorderColor(Colors.Grey.Lighten1)
                    .PaddingTop(4).AlignRight().Text(total.ToString("$#,##0.00")).Bold().FontSize(9);
            });
        }
    }

    private void ComposeFooter(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().LineHorizontal(0.5f);
            column.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Text("Generated by Property Manager")
                    .FontSize(8).FontColor(Colors.Grey.Medium);
                row.RelativeItem().AlignRight().Text(text =>
                {
                    text.Span("Page ").FontSize(8).FontColor(Colors.Grey.Medium);
                    text.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Medium);
                    text.Span(" of ").FontSize(8).FontColor(Colors.Grey.Medium);
                    text.TotalPages().FontSize(8).FontColor(Colors.Grey.Medium);
                });
            });
        });
    }

    private static string GetStatusColor(string status)
    {
        return status switch
        {
            "Reported" => Colors.Orange.Darken1,
            "Assigned" => Colors.Blue.Darken1,
            "Completed" => Colors.Green.Darken2,
            _ => Colors.Grey.Darken2
        };
    }
}
