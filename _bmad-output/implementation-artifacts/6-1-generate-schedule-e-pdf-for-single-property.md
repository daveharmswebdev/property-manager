# Story 6.1: Generate Schedule E PDF for Single Property

Status: done

## Story

As a property owner,
I want to generate a Schedule E worksheet PDF for one property,
So that I can see a tax-ready summary of that property's finances.

## Acceptance Criteria

1. **AC-6.1.1**: Report generation modal on property detail page
   - Given I am on a property detail page
   - When I click "Generate Report"
   - Then I see a modal with options:
     - Tax Year (dropdown, defaults to currently selected year)
     - [Preview] and [Download] buttons

2. **AC-6.1.2**: PDF preview functionality
   - Given I click "Preview"
   - When the PDF generates
   - Then I see a preview of the Schedule E worksheet in the modal
   - And I can scroll through the document

3. **AC-6.1.3**: PDF download functionality
   - Given I click "Download"
   - When the PDF generates
   - Then the file downloads to my device
   - And filename format: `Schedule-E-{PropertyName}-{Year}.pdf`

4. **AC-6.1.4**: PDF content - complete Schedule E format
   - Given the PDF content
   - When I view it
   - Then it includes:
     - Property address at top
     - Tax year
     - Income section: Total rental income for the year
     - Expense section: Totals by IRS Schedule E category
       - Line 5: Advertising
       - Line 6: Auto and travel
       - Line 7: Cleaning and maintenance
       - Line 8: Commissions
       - Line 9: Insurance
       - Line 10: Legal and professional fees
       - Line 11: Management fees
       - Line 12: Mortgage interest
       - Line 13: Other interest
       - Line 14: Repairs
       - Line 15: Supplies
       - Line 16: Taxes
       - Line 17: Utilities
       - Line 18: Depreciation
       - Line 19: Other
     - Net income/loss calculation
     - Generated date and "Property Manager" watermark

5. **AC-6.1.5**: Loading and error states
   - Given I initiate report generation
   - When the PDF is being generated
   - Then I see a loading spinner with "Generating report..."
   - And if generation fails, I see an error message with retry option

## Tasks / Subtasks

- [x] Task 1: Add QuestPDF Package (AC: 6.1.4)
  - [x] Add QuestPDF NuGet package to PropertyManager.Infrastructure
  - [x] Configure QuestPDF license (Community MIT for < $1M revenue)
  - [x] Create basic QuestPDF setup in DependencyInjection.cs

- [x] Task 2: Create Schedule E Report Domain Models (AC: 6.1.4)
  - [x] Create `ScheduleEReport` record in Application layer
  - [x] Create `ScheduleELineItem` record for expense categories
  - [x] Create `ScheduleECategoryMapping` to map CategoryId to Schedule E line numbers

- [x] Task 3: Create Report Generation Query (AC: 6.1.1, 6.1.4)
  - [x] Create `GenerateScheduleEReport.cs` in Application/Reports/
  - [x] Query: `GenerateScheduleEReportQuery(Guid PropertyId, int Year)`
  - [x] Response: `ScheduleEReportDto` with all data needed for PDF
  - [x] Aggregate expenses by category, sum income
  - [x] Calculate net income/loss

- [x] Task 4: Create PDF Document Generator (AC: 6.1.4)
  - [x] Create `IScheduleEPdfGenerator` interface in Application/Common/Interfaces
  - [x] Create `ScheduleEPdfGenerator.cs` in Infrastructure/Reports/
  - [x] Implement QuestPDF document structure matching IRS Schedule E format
  - [x] Include property address header, tax year, income section
  - [x] Include all 15 expense category lines with amounts
  - [x] Include net income calculation and footer

- [x] Task 5: Create Reports Controller Endpoint (AC: 6.1.1, 6.1.2, 6.1.3)
  - [x] Create `ReportsController.cs` if not exists
  - [x] Add endpoint: `POST /api/v1/reports/schedule-e`
  - [x] Request body: `{ propertyId: guid, year: int }`
  - [x] Response: PDF binary with appropriate content-type
  - [x] Add `Content-Disposition` header for filename

- [x] Task 6: Create Frontend Report Dialog Component (AC: 6.1.1, 6.1.5)
  - [x] Create `frontend/src/app/features/reports/` directory structure
  - [x] Create `report-dialog.component.ts` with MatDialog
  - [x] Add year selector dropdown (defaults to current selected year)
  - [x] Add Preview and Download buttons
  - [x] Add loading spinner and error handling

- [x] Task 7: Create Report Service (AC: 6.1.2, 6.1.3)
  - [x] Create `report.service.ts` in features/reports/services/
  - [x] Add method: `generateScheduleE(propertyId, year): Observable<Blob>`
  - [x] Handle binary PDF response
  - [x] Implement download trigger using Blob URL

- [x] Task 8: Add PDF Preview Component (AC: 6.1.2)
  - [x] Create `pdf-preview.component.ts` in features/reports/components/
  - [x] Use browser native PDF rendering (object/embed tag) or pdf.js
  - [x] Add scrolling for multi-page documents
  - [x] Add zoom controls if using pdf.js

- [x] Task 9: Integrate Report Button on Property Detail (AC: 6.1.1)
  - [x] Add "Generate Report" button to property-detail.component.ts
  - [x] Wire up MatDialog to open report-dialog
  - [x] Pass propertyId and current year to dialog

- [x] Task 10: Write Backend Unit Tests
  - [x] Test GenerateScheduleEReportHandler - correct aggregation
  - [x] Test ScheduleEPdfGenerator - PDF generation
  - [x] Test category mapping to Schedule E lines
  - [x] Test edge cases: no expenses, no income, all zeros

- [x] Task 11: Write Frontend Unit Tests
  - [x] Test ReportDialogComponent - year selection, button states
  - [x] Test ReportService - API call, blob handling
  - [x] Test download functionality

- [x] Task 12: E2E Tests
  - [x] Test full flow: property detail → generate report → download
  - [x] Verify PDF downloads with correct filename

- [x] Task 13: Manual Verification Checklist
  - [x] Generate report for property with expenses in all categories
  - [x] Verify PDF opens and displays correctly
  - [x] Verify all expense categories show correct totals
  - [x] Verify income total is correct
  - [x] Verify net income calculation is correct
  - [x] Verify different year shows different data
  - [x] Verify property with no data shows $0 values

## Dev Notes

### Architecture Patterns

**Clean Architecture Report Generation:**
```
PropertyManager.Api/
├── Controllers/
│   └── ReportsController.cs              # NEW - Report endpoints

PropertyManager.Application/
├── Common/
│   └── Interfaces/
│       └── IScheduleEPdfGenerator.cs     # NEW - PDF generation interface
├── Reports/
│   ├── GenerateScheduleEReport.cs        # NEW - Query + Handler
│   └── Dtos/
│       └── ScheduleEReportDto.cs         # NEW - Report data model

PropertyManager.Infrastructure/
├── Reports/
│   └── ScheduleEPdfGenerator.cs          # NEW - QuestPDF implementation

frontend/src/app/
├── features/
│   └── reports/
│       ├── reports.routes.ts             # NEW - Route config
│       ├── components/
│       │   ├── report-dialog/            # NEW - Generation dialog
│       │   └── pdf-preview/              # NEW - PDF viewer
│       └── services/
│           └── report.service.ts         # NEW - API calls
```

### Backend Implementation

**QuestPDF Setup:**
```csharp
// Infrastructure/DependencyInjection.cs
public static IServiceCollection AddInfrastructure(this IServiceCollection services)
{
    // QuestPDF license configuration (Community MIT for < $1M revenue)
    QuestPDF.Settings.License = LicenseType.Community;

    services.AddScoped<IScheduleEPdfGenerator, ScheduleEPdfGenerator>();
    // ... existing registrations
}
```

**Schedule E Category Mapping:**
```csharp
// Application/Reports/ScheduleECategoryMapping.cs
public static class ScheduleECategoryMapping
{
    public static readonly Dictionary<string, int> CategoryToLine = new()
    {
        { "Advertising", 5 },
        { "Auto and Travel", 6 },
        { "Cleaning and Maintenance", 7 },
        { "Commissions", 8 },
        { "Insurance", 9 },
        { "Legal and Professional Fees", 10 },
        { "Management Fees", 11 },
        { "Mortgage Interest", 12 },
        { "Other Interest", 13 },
        { "Repairs", 14 },
        { "Supplies", 15 },
        { "Taxes", 16 },
        { "Utilities", 17 },
        { "Depreciation", 18 },
        { "Other", 19 }
    };
}
```

**GenerateScheduleEReport Query:**
```csharp
// Application/Reports/GenerateScheduleEReport.cs
public record GenerateScheduleEReportQuery(Guid PropertyId, int Year) : IRequest<ScheduleEReportDto>;

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

public record ScheduleELineItemDto(
    int LineNumber,
    string CategoryName,
    decimal Amount
);

public class GenerateScheduleEReportHandler : IRequestHandler<GenerateScheduleEReportQuery, ScheduleEReportDto>
{
    private readonly AppDbContext _context;
    private readonly ICurrentUser _currentUser;

    public async Task<ScheduleEReportDto> Handle(GenerateScheduleEReportQuery request, CancellationToken ct)
    {
        var property = await _context.Properties
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.AccountId == _currentUser.AccountId, ct)
            ?? throw new NotFoundException("Property", request.PropertyId);

        var startDate = new DateOnly(request.Year, 1, 1);
        var endDate = new DateOnly(request.Year, 12, 31);

        // Get expenses grouped by category
        var expensesByCategory = await _context.Expenses
            .Include(e => e.Category)
            .Where(e => e.PropertyId == request.PropertyId
                     && e.Date >= startDate
                     && e.Date <= endDate)
            .GroupBy(e => new { e.Category.Id, e.Category.Name, e.Category.ScheduleELine })
            .Select(g => new ScheduleELineItemDto(
                g.Key.ScheduleELine ?? 19, // Default to "Other" line 19
                g.Key.Name,
                g.Sum(e => e.Amount)
            ))
            .ToListAsync(ct);

        // Get total income
        var totalIncome = await _context.Income
            .Where(i => i.PropertyId == request.PropertyId
                     && i.Date >= startDate
                     && i.Date <= endDate)
            .SumAsync(i => i.Amount, ct);

        var totalExpenses = expensesByCategory.Sum(e => e.Amount);

        return new ScheduleEReportDto(
            property.Id,
            property.Name,
            property.Address ?? "",
            request.Year,
            totalIncome,
            expensesByCategory.OrderBy(e => e.LineNumber).ToList(),
            totalExpenses,
            totalIncome - totalExpenses,
            DateTime.UtcNow
        );
    }
}
```

**QuestPDF Document Generator:**
```csharp
// Infrastructure/Reports/ScheduleEPdfGenerator.cs
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

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
                row.ConstantItem(100).AlignRight().Text(report.TotalIncome.ToString("C"));
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
                    row.ConstantItem(100).AlignRight().Text(line.Amount.ToString("C"));
                });
            }

            column.Item().PaddingVertical(5).LineHorizontal(0.5f);
            column.Item().Row(row =>
            {
                row.RelativeItem().Text("Total Expenses").Bold();
                row.ConstantItem(100).AlignRight().Text(report.TotalExpenses.ToString("C")).Bold();
            });

            // Net Income
            column.Item().PaddingVertical(10).LineHorizontal(1);
            column.Item().Row(row =>
            {
                row.RelativeItem().Text("NET INCOME (LOSS)").Bold().FontSize(12);
                row.ConstantItem(100).AlignRight()
                    .Text(report.NetIncome.ToString("C"))
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

    private IEnumerable<ScheduleELineItemDto> GetAllScheduleELines(List<ScheduleELineItemDto> reported)
    {
        // Return all 15 lines, with $0 for any not in the report
        var allLines = ScheduleECategoryMapping.CategoryToLine
            .Select(kvp =>
            {
                var existing = reported.FirstOrDefault(r => r.LineNumber == kvp.Value);
                return new ScheduleELineItemDto(
                    kvp.Value,
                    kvp.Key,
                    existing?.Amount ?? 0
                );
            })
            .OrderBy(l => l.LineNumber);

        return allLines;
    }
}
```

**Reports Controller:**
```csharp
// Api/Controllers/ReportsController.cs
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IScheduleEPdfGenerator _pdfGenerator;

    public ReportsController(IMediator mediator, IScheduleEPdfGenerator pdfGenerator)
    {
        _mediator = mediator;
        _pdfGenerator = pdfGenerator;
    }

    [HttpPost("schedule-e")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateScheduleE(
        [FromBody] GenerateScheduleERequest request,
        CancellationToken ct)
    {
        var reportData = await _mediator.Send(
            new GenerateScheduleEReportQuery(request.PropertyId, request.Year), ct);

        var pdfBytes = _pdfGenerator.Generate(reportData);

        var sanitizedName = new string(reportData.PropertyName
            .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')
            .ToArray())
            .Replace(' ', '-');

        var filename = $"Schedule-E-{sanitizedName}-{request.Year}.pdf";

        return File(pdfBytes, "application/pdf", filename);
    }
}

public record GenerateScheduleERequest(Guid PropertyId, int Year);
```

### Frontend Implementation

**Report Dialog Component:**
```typescript
// features/reports/components/report-dialog/report-dialog.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReportService } from '../../services/report.service';
import { PdfPreviewComponent } from '../pdf-preview/pdf-preview.component';

export interface ReportDialogData {
  propertyId: string;
  propertyName: string;
  currentYear: number;
}

@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PdfPreviewComponent
  ],
  template: `
    <h2 mat-dialog-title>Generate Schedule E Report</h2>
    <mat-dialog-content>
      <p>Property: <strong>{{ data.propertyName }}</strong></p>

      <mat-form-field appearance="outline">
        <mat-label>Tax Year</mat-label>
        <mat-select [(value)]="selectedYear">
          @for (year of availableYears; track year) {
            <mat-option [value]="year">{{ year }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Generating report...</p>
        </div>
      }

      @if (error()) {
        <div class="error-message">
          <p>{{ error() }}</p>
          <button mat-button color="primary" (click)="clearError()">Try Again</button>
        </div>
      }

      @if (previewUrl()) {
        <app-pdf-preview [pdfUrl]="previewUrl()!"></app-pdf-preview>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-stroked-button
              color="primary"
              (click)="preview()"
              [disabled]="isLoading()">
        Preview
      </button>
      <button mat-flat-button
              color="primary"
              (click)="download()"
              [disabled]="isLoading()">
        Download
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-form-field { width: 100%; margin-bottom: 16px; }
    .loading-container { display: flex; flex-direction: column; align-items: center; padding: 24px; }
    .error-message { color: #ef5350; padding: 16px; text-align: center; }
    app-pdf-preview { display: block; height: 400px; margin-top: 16px; }
  `]
})
export class ReportDialogComponent {
  private readonly reportService = inject(ReportService);
  readonly dialogRef = inject(MatDialogRef<ReportDialogComponent>);
  readonly data = inject<ReportDialogData>(MAT_DIALOG_DATA);

  selectedYear = this.data.currentYear;
  availableYears = this.generateYearOptions();

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly previewUrl = signal<string | null>(null);

  private generateYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }

  async preview(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const blob = await this.reportService.generateScheduleE(
        this.data.propertyId,
        this.selectedYear
      );
      const url = URL.createObjectURL(blob);
      this.previewUrl.set(url);
    } catch (err) {
      this.error.set('Failed to generate report. Please try again.');
      console.error('Report generation failed:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async download(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const blob = await this.reportService.generateScheduleE(
        this.data.propertyId,
        this.selectedYear
      );
      this.reportService.downloadPdf(blob, this.data.propertyName, this.selectedYear);
    } catch (err) {
      this.error.set('Failed to download report. Please try again.');
      console.error('Report download failed:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  clearError(): void {
    this.error.set(null);
  }
}
```

**Report Service:**
```typescript
// features/reports/services/report.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  async generateScheduleE(propertyId: string, year: number): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/v1/reports/schedule-e',
        { propertyId, year },
        { responseType: 'blob' }
      )
    );
  }

  downloadPdf(blob: Blob, propertyName: string, year: number): void {
    const sanitizedName = propertyName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/ /g, '-');
    const filename = `Schedule-E-${sanitizedName}-${year}.pdf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
```

**PDF Preview Component:**
```typescript
// features/reports/components/pdf-preview/pdf-preview.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-pdf-preview',
  standalone: true,
  template: `
    <div class="pdf-container">
      <object [data]="pdfUrl()" type="application/pdf" width="100%" height="100%">
        <p>Your browser doesn't support PDF preview.
           <a [href]="pdfUrl()" target="_blank">Download the PDF</a> instead.
        </p>
      </object>
    </div>
  `,
  styles: [`
    .pdf-container {
      width: 100%;
      height: 100%;
      min-height: 400px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }
  `]
})
export class PdfPreviewComponent {
  pdfUrl = input.required<string>();
}
```

**Integration in Property Detail:**
```typescript
// Update property-detail.component.ts
import { MatDialog } from '@angular/material/dialog';
import { ReportDialogComponent, ReportDialogData } from '../reports/components/report-dialog/report-dialog.component';

// In component class:
private readonly dialog = inject(MatDialog);

openReportDialog(): void {
  const property = this.propertyStore.selectedProperty();
  if (!property) return;

  this.dialog.open(ReportDialogComponent, {
    width: '600px',
    data: {
      propertyId: property.id,
      propertyName: property.name,
      currentYear: this.yearSelectorStore.selectedYear()
    } as ReportDialogData
  });
}

// In template, add button:
// <button mat-flat-button color="primary" (click)="openReportDialog()">
//   <mat-icon>description</mat-icon>
//   Generate Report
// </button>
```

### Database Updates

**ExpenseCategory Schema:**
The `ScheduleELine` column should already exist from Story 1.2. Verify it's populated:

```sql
-- Verify seed data includes ScheduleELine values
SELECT Id, Name, ScheduleELine, SortOrder FROM ExpenseCategories;

-- Expected values:
-- Advertising = 5
-- Auto and Travel = 6
-- Cleaning and Maintenance = 7
-- etc.
```

### Package Dependencies

**Backend (NuGet):**
```bash
cd backend/src/PropertyManager.Infrastructure
dotnet add package QuestPDF
```

**Frontend (npm):**
No new packages required - uses native browser PDF rendering.

### Previous Story Learnings (From Epic 5)

**Patterns to Follow:**
- Signal-based state management with `signal()` and computed signals
- MatDialog patterns for modals (see receipt processing dialog)
- data-testid attributes for all interactive elements
- Snackbar for user feedback after actions
- Loading states with `isLoading` signal pattern
- Error handling with retry capability

**Existing Code to Leverage:**
- `YearSelectorStore` for current tax year (Story 3.5)
- `PropertyStore` for property data
- MatDialog infrastructure already configured
- HTTP interceptor handles auth tokens automatically

### Git Context

Recent commits showing established patterns:
- `a77359d` feat(receipts): Add real-time receipt sync with SignalR (#5.6)
- `3f12bc0` feat(receipts): Add view and delete receipts functionality (#49)

These show the dialog patterns, service structure, and testing approaches to follow.

### Testing Strategy

**Backend Unit Tests (xUnit):**
```csharp
[Fact]
public async Task Handle_ValidProperty_ReturnsReportWithCorrectTotals()
{
    // Arrange: Property with expenses and income for the year
    // Act: Call handler
    // Assert: Totals match, all categories present
}

[Fact]
public async Task Handle_PropertyWithNoData_ReturnsZeroValues()
{
    // Arrange: Property with no expenses or income
    // Act: Call handler
    // Assert: All values are 0, no exceptions
}

[Fact]
public async Task Generate_ValidReport_ProducesPdfBytes()
{
    // Arrange: Valid ScheduleEReportDto
    // Act: Call PDF generator
    // Assert: Returns non-empty byte array, valid PDF header
}
```

**Frontend Unit Tests (Vitest):**
```typescript
describe('ReportDialogComponent', () => {
  it('should generate preview on preview button click', async () => {
    // Mock ReportService, verify preview URL set
  });

  it('should trigger download on download button click', async () => {
    // Mock ReportService, verify downloadPdf called
  });

  it('should show loading state during generation', async () => {
    // Verify spinner appears during async operation
  });
});
```

### Project Structure Notes

- Reports feature follows same structure as other features (receipts, expenses)
- QuestPDF generator placed in Infrastructure layer (external dependency)
- Interface defined in Application layer for testability
- Controller returns raw PDF bytes (not stored in DB for single reports)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1: Generate Schedule E PDF for Single Property]
- [Source: _bmad-output/planning-artifacts/prd.md#Tax Reporting]
- [Source: _bmad-output/planning-artifacts/architecture.md#Reports]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Journey: Generate Tax Reports]
- [QuestPDF Documentation](https://www.questpdf.com)
- [QuestPDF GitHub](https://github.com/questpdf/questpdf)
- [IRS Schedule E Form](https://www.irs.gov/forms-pubs/about-schedule-e-form-1040)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

