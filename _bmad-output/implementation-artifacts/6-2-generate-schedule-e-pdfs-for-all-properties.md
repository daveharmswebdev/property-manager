# Story 6.2: Generate Schedule E PDFs for All Properties

Status: done

## Story

As a property owner with 14 rental properties,
I want to generate Schedule E worksheets for all properties at once,
So that I have everything ready for tax time in one click.

## Acceptance Criteria

1. **AC-6.2.1**: Reports page with batch generation
   - Given I am on the Reports page
   - When I click "Generate All Schedule E Reports"
   - Then I see a modal with:
     - Tax Year selector (dropdown, defaults to currently selected year)
     - List of all properties with checkboxes (all checked by default)
     - Property names and addresses visible
     - [Generate] button

2. **AC-6.2.2**: Property selection in modal
   - Given the batch report modal is open
   - When I toggle property checkboxes
   - Then I can select/deselect specific properties
   - And I see a "Select All" / "Deselect All" toggle
   - And the Generate button shows count: "Generate (14 Reports)"

3. **AC-6.2.3**: Progress indicator during generation
   - Given I click "Generate"
   - When the generation starts
   - Then I see a progress indicator: "Generating 14 reports..."
   - And I see individual property status updating as each completes
   - And the Generate button is disabled during processing

4. **AC-6.2.4**: Completion with download options
   - Given all PDFs are generated
   - When the process completes
   - Then I see a success message with count
   - And I have the option to:
     - Download as ZIP file (all PDFs bundled)
     - Download individually from the list
   - And snackbar shows "14 reports ready for download"

5. **AC-6.2.5**: ZIP file content
   - Given I download the ZIP file
   - When I open it
   - Then it contains individual PDFs named: `Schedule-E-{PropertyName}-{Year}.pdf`
   - And all selected properties have their reports included
   - And the ZIP file itself is named: `Schedule-E-Reports-{Year}.zip`

6. **AC-6.2.6**: Empty data handling
   - Given some properties have no expenses or income for the selected year
   - When I generate reports
   - Then those properties generate PDFs showing $0 totals
   - And I see a warning icon next to properties with no data
   - And tooltip explains: "No transactions recorded for this year"

7. **AC-6.2.7**: Error handling
   - Given a report fails to generate
   - When processing completes
   - Then failed reports show error status
   - And I can retry failed reports individually
   - And successfully generated reports are still downloadable

## Tasks / Subtasks

- [x] Task 1: Create Batch Report Generation Query (AC: 6.2.1, 6.2.3)
  - [x] Create `GenerateBatchScheduleEReports.cs` in Application/Reports/
  - [x] Query: `GenerateBatchScheduleEReportsQuery(List<Guid> PropertyIds, int Year)`
  - [x] Response: `BatchScheduleEReportDto` with list of individual reports
  - [x] Sequential generation (DbContext is not thread-safe for parallel MediatR calls)
  - [x] Include property metadata in response for progress tracking

- [x] Task 2: Create ZIP Bundle Service (AC: 6.2.4, 6.2.5)
  - [x] Create `IReportBundleService` interface in Application/Common/Interfaces
  - [x] Create `ReportBundleService.cs` in Infrastructure/Reports/
  - [x] Use System.IO.Compression.ZipArchive for bundling
  - [x] Generate properly named ZIP file with all PDFs

- [x] Task 3: Create Batch Reports Controller Endpoint (AC: 6.2.1, 6.2.4)
  - [x] Add endpoint: `POST /api/v1/reports/schedule-e/batch`
  - [x] Request body: `{ propertyIds: guid[], year: int }`
  - [x] Response: ZIP file binary with appropriate content-type
  - [x] Add `Content-Disposition` header for filename

- [x] Task 4: Create Reports Page Component (AC: 6.2.1)
  - [x] Create `reports.component.ts` if not exists
  - [x] Add route `/reports` with navigation link
  - [x] Add "Generate All Schedule E Reports" button
  - [x] Display empty state when no reports generated yet

- [x] Task 5: Create Batch Report Dialog Component (AC: 6.2.1, 6.2.2)
  - [x] Create `batch-report-dialog.component.ts` in features/reports/components/
  - [x] Add year selector dropdown
  - [x] Add property list with checkboxes (fetched from PropertyStore)
  - [x] Add select all/deselect all toggle
  - [x] Dynamic button text showing count

- [x] Task 6: Implement Progress Tracking (AC: 6.2.3)
  - [x] Add progress signal to batch dialog
  - [x] Show "Generating X reports..." with spinner
  - [x] Update progress as each property completes (if streaming response)
  - [x] Disable Generate button during processing

- [x] Task 7: Implement Download Options (AC: 6.2.4, 6.2.5)
  - [x] Add "Download All (ZIP)" button on completion
  - [x] Add individual download links for each property
  - [x] Implement ZIP download using Blob URL
  - [x] Show success snackbar with count

- [x] Task 8: Handle Empty Data Properties (AC: 6.2.6)
  - [x] Query to identify properties with no data for year
  - [x] Show warning icon next to empty properties in list
  - [x] Add tooltip explaining no data
  - [x] Still generate $0 reports for empty properties

- [x] Task 9: Error Handling (AC: 6.2.7)
  - [x] Catch individual property generation failures
  - [x] Show error status for failed properties
  - [x] Allow retry of failed reports
  - [x] Ensure partial success is downloadable

- [x] Task 10: Write Backend Unit Tests
  - [x] Test GenerateBatchScheduleEReportsHandler - sequential generation
  - [x] Test ReportBundleService - ZIP creation with multiple PDFs
  - [x] Test empty properties get $0 reports
  - [x] Test partial failures don't break entire batch

- [x] Task 11: Write Frontend Unit Tests
  - [x] Test BatchReportDialogComponent - property selection, progress states
  - [x] Test ReportService - batch API call, ZIP blob handling
  - [x] Test download functionality for ZIP

- [x] Task 12: E2E Tests
  - [x] Test full flow: Reports page → batch dialog → generate → download ZIP
  - [x] Verify ZIP contains correct number of PDFs
  - [x] Test with properties having no data

## Dev Notes

### Architecture Patterns

**Extending Existing Report Infrastructure:**
```
PropertyManager.Api/
├── Controllers/
│   └── ReportsController.cs              # ADD batch endpoint

PropertyManager.Application/
├── Common/
│   └── Interfaces/
│       └── IReportBundleService.cs       # NEW - ZIP bundling interface
├── Reports/
│   ├── GenerateScheduleEReport.cs        # EXISTING (from 6.1)
│   ├── GenerateBatchScheduleEReports.cs  # NEW - Batch query + handler
│   └── Dtos/
│       └── BatchScheduleEReportDto.cs    # NEW - Batch response model

PropertyManager.Infrastructure/
├── Reports/
│   ├── ScheduleEPdfGenerator.cs          # EXISTING (from 6.1)
│   └── ReportBundleService.cs            # NEW - ZIP creation

frontend/src/app/
├── features/
│   └── reports/
│       ├── reports.component.ts          # UPDATE - Add batch button
│       ├── reports.routes.ts             # EXISTING
│       ├── components/
│       │   ├── report-dialog/            # EXISTING (from 6.1)
│       │   ├── batch-report-dialog/      # NEW - Batch generation dialog
│       │   └── pdf-preview/              # EXISTING (from 6.1)
│       └── services/
│           └── report.service.ts         # UPDATE - Add batch methods
```

### Backend Implementation

**Batch Report Query:**
```csharp
// Application/Reports/GenerateBatchScheduleEReports.cs
public record GenerateBatchScheduleEReportsQuery(
    List<Guid> PropertyIds,
    int Year
) : IRequest<BatchScheduleEReportDto>;

public record BatchScheduleEReportDto(
    int Year,
    List<PropertyReportResult> Results,
    DateTime GeneratedAt
);

public record PropertyReportResult(
    Guid PropertyId,
    string PropertyName,
    bool HasData,
    bool Success,
    string? ErrorMessage,
    byte[]? PdfBytes  // null if failed
);

public class GenerateBatchScheduleEReportsHandler
    : IRequestHandler<GenerateBatchScheduleEReportsQuery, BatchScheduleEReportDto>
{
    private readonly AppDbContext _context;
    private readonly ICurrentUser _currentUser;
    private readonly IScheduleEPdfGenerator _pdfGenerator;
    private readonly IMediator _mediator;

    public async Task<BatchScheduleEReportDto> Handle(
        GenerateBatchScheduleEReportsQuery request,
        CancellationToken ct)
    {
        // Validate all properties belong to user's account
        var properties = await _context.Properties
            .Where(p => request.PropertyIds.Contains(p.Id)
                     && p.AccountId == _currentUser.AccountId)
            .ToListAsync(ct);

        if (properties.Count != request.PropertyIds.Count)
            throw new ValidationException("One or more properties not found");

        // Generate reports in parallel
        var tasks = properties.Select(async property =>
        {
            try
            {
                var reportData = await _mediator.Send(
                    new GenerateScheduleEReportQuery(property.Id, request.Year), ct);

                var pdfBytes = _pdfGenerator.Generate(reportData);
                var hasData = reportData.TotalIncome > 0 || reportData.TotalExpenses > 0;

                return new PropertyReportResult(
                    property.Id,
                    property.Name,
                    hasData,
                    true,
                    null,
                    pdfBytes
                );
            }
            catch (Exception ex)
            {
                return new PropertyReportResult(
                    property.Id,
                    property.Name,
                    false,
                    false,
                    ex.Message,
                    null
                );
            }
        });

        var results = await Task.WhenAll(tasks);

        return new BatchScheduleEReportDto(
            request.Year,
            results.ToList(),
            DateTime.UtcNow
        );
    }
}
```

**ZIP Bundle Service:**
```csharp
// Application/Common/Interfaces/IReportBundleService.cs
public interface IReportBundleService
{
    byte[] CreateZipBundle(IEnumerable<(string FileName, byte[] Content)> files, string bundleName);
}

// Infrastructure/Reports/ReportBundleService.cs
using System.IO.Compression;

public class ReportBundleService : IReportBundleService
{
    public byte[] CreateZipBundle(
        IEnumerable<(string FileName, byte[] Content)> files,
        string bundleName)
    {
        using var memoryStream = new MemoryStream();
        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            foreach (var (fileName, content) in files)
            {
                var entry = archive.CreateEntry(fileName, CompressionLevel.Optimal);
                using var entryStream = entry.Open();
                entryStream.Write(content, 0, content.Length);
            }
        }

        return memoryStream.ToArray();
    }
}
```

**Batch Reports Controller Endpoint:**
```csharp
// Add to Api/Controllers/ReportsController.cs

[HttpPost("schedule-e/batch")]
[ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]
public async Task<IActionResult> GenerateBatchScheduleE(
    [FromBody] GenerateBatchScheduleERequest request,
    CancellationToken ct)
{
    var batchResult = await _mediator.Send(
        new GenerateBatchScheduleEReportsQuery(request.PropertyIds, request.Year), ct);

    // Collect successful PDFs for bundling
    var pdfFiles = batchResult.Results
        .Where(r => r.Success && r.PdfBytes != null)
        .Select(r =>
        {
            var sanitizedName = SanitizeFileName(r.PropertyName);
            return ($"Schedule-E-{sanitizedName}-{request.Year}.pdf", r.PdfBytes!);
        });

    if (!pdfFiles.Any())
        return BadRequest(new ProblemDetails
        {
            Title = "No reports generated",
            Detail = "All report generations failed",
            Status = 400
        });

    var zipBytes = _bundleService.CreateZipBundle(
        pdfFiles,
        $"Schedule-E-Reports-{request.Year}");

    var filename = $"Schedule-E-Reports-{request.Year}.zip";

    return File(zipBytes, "application/zip", filename);
}

public record GenerateBatchScheduleERequest(List<Guid> PropertyIds, int Year);

private static string SanitizeFileName(string name)
{
    return new string(name
        .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')
        .ToArray())
        .Replace(' ', '-');
}
```

### Frontend Implementation

**Reports Page Component (update):**
```typescript
// features/reports/reports.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { BatchReportDialogComponent } from './components/batch-report-dialog/batch-report-dialog.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="reports-page">
      <header class="page-header">
        <h1>Tax Reports</h1>
        <button mat-flat-button
                color="primary"
                (click)="openBatchDialog()"
                data-testid="generate-all-reports-btn">
          <mat-icon>summarize</mat-icon>
          Generate All Schedule E Reports
        </button>
      </header>

      <section class="reports-content">
        <!-- Placeholder for future: list of generated reports (Story 6.3) -->
        <div class="empty-state">
          <mat-icon>description</mat-icon>
          <p>Generate Schedule E worksheets for tax reporting.</p>
          <p class="hint">Click the button above to generate reports for all your properties.</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .reports-page { padding: 24px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      text-align: center;
      color: rgba(0,0,0,0.6);
    }
    .empty-state mat-icon { font-size: 64px; height: 64px; width: 64px; margin-bottom: 16px; }
    .hint { font-size: 14px; color: rgba(0,0,0,0.4); }
  `]
})
export class ReportsComponent {
  private readonly dialog = inject(MatDialog);

  openBatchDialog(): void {
    this.dialog.open(BatchReportDialogComponent, {
      width: '600px',
      maxHeight: '80vh'
    });
  }
}
```

**Batch Report Dialog Component:**
```typescript
// features/reports/components/batch-report-dialog/batch-report-dialog.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReportService } from '../../services/report.service';
import { PropertyStore } from '../../../properties/stores/property.store';
import { YearSelectorStore } from '../../../../core/stores/year-selector.store';

interface PropertySelection {
  id: string;
  name: string;
  address: string;
  selected: boolean;
  hasDataForYear?: boolean;
}

@Component({
  selector: 'app-batch-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>Generate All Schedule E Reports</h2>

    <mat-dialog-content>
      <mat-form-field appearance="outline" class="year-field">
        <mat-label>Tax Year</mat-label>
        <mat-select [(value)]="selectedYear" data-testid="year-select">
          @for (year of availableYears; track year) {
            <mat-option [value]="year">{{ year }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <div class="property-list-header">
        <span class="property-count">Properties ({{ selectedCount() }} selected)</span>
        <button mat-button
                (click)="toggleAll()"
                data-testid="toggle-all-btn">
          {{ allSelected() ? 'Deselect All' : 'Select All' }}
        </button>
      </div>

      <div class="property-list" data-testid="property-list">
        @for (property of properties(); track property.id) {
          <div class="property-item">
            <mat-checkbox
              [checked]="property.selected"
              (change)="toggleProperty(property.id)"
              data-testid="property-checkbox-{{ property.id }}">
              <div class="property-info">
                <span class="property-name">{{ property.name }}</span>
                <span class="property-address">{{ property.address }}</span>
              </div>
            </mat-checkbox>
            @if (property.hasDataForYear === false) {
              <mat-icon
                class="warning-icon"
                matTooltip="No transactions recorded for {{ selectedYear }}"
                data-testid="no-data-warning-{{ property.id }}">
                warning
              </mat-icon>
            }
          </div>
        }
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Generating {{ selectedCount() }} reports...</p>
        </div>
      }

      @if (error()) {
        <div class="error-message">
          <p>{{ error() }}</p>
          <button mat-button color="primary" (click)="clearError()">Try Again</button>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close data-testid="cancel-btn">Cancel</button>
      <button mat-flat-button
              color="primary"
              [disabled]="isLoading() || selectedCount() === 0"
              (click)="generate()"
              data-testid="generate-btn">
        Generate ({{ selectedCount() }} Reports)
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .year-field { width: 100%; margin-bottom: 16px; }
    .property-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .property-count { font-weight: 500; }
    .property-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }
    .property-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-bottom: 1px solid #f0f0f0;
    }
    .property-item:last-child { border-bottom: none; }
    .property-info { display: flex; flex-direction: column; }
    .property-name { font-weight: 500; }
    .property-address { font-size: 12px; color: rgba(0,0,0,0.6); }
    .warning-icon { color: #ff9800; font-size: 20px; }
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
    }
    .error-message { color: #ef5350; padding: 16px; text-align: center; }
  `]
})
export class BatchReportDialogComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly propertyStore = inject(PropertyStore);
  private readonly yearStore = inject(YearSelectorStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<BatchReportDialogComponent>);

  selectedYear = this.yearStore.selectedYear();
  availableYears = this.generateYearOptions();

  properties = signal<PropertySelection[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedCount = computed(() =>
    this.properties().filter(p => p.selected).length
  );

  readonly allSelected = computed(() =>
    this.properties().length > 0 &&
    this.properties().every(p => p.selected)
  );

  ngOnInit(): void {
    // Load properties from store
    const storeProperties = this.propertyStore.properties();
    this.properties.set(
      storeProperties.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address ?? '',
        selected: true,
        hasDataForYear: undefined // Could be populated via API if needed
      }))
    );
  }

  private generateYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => currentYear - i);
  }

  toggleProperty(id: string): void {
    this.properties.update(props =>
      props.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  }

  toggleAll(): void {
    const newValue = !this.allSelected();
    this.properties.update(props =>
      props.map(p => ({ ...p, selected: newValue }))
    );
  }

  clearError(): void {
    this.error.set(null);
  }

  async generate(): Promise<void> {
    const selectedIds = this.properties()
      .filter(p => p.selected)
      .map(p => p.id);

    if (selectedIds.length === 0) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const blob = await this.reportService.generateBatchScheduleE(
        selectedIds,
        this.selectedYear
      );

      this.reportService.downloadZip(blob, this.selectedYear);

      this.snackBar.open(
        `${selectedIds.length} reports ready for download`,
        'Close',
        { duration: 5000 }
      );

      this.dialogRef.close(true);
    } catch (err) {
      this.error.set('Failed to generate reports. Please try again.');
      console.error('Batch report generation failed:', err);
    } finally {
      this.isLoading.set(false);
    }
  }
}
```

**Report Service (update):**
```typescript
// Update features/reports/services/report.service.ts
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  // Existing method from 6.1
  async generateScheduleE(propertyId: string, year: number): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/v1/reports/schedule-e',
        { propertyId, year },
        { responseType: 'blob' }
      )
    );
  }

  // NEW: Batch generation
  async generateBatchScheduleE(propertyIds: string[], year: number): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/v1/reports/schedule-e/batch',
        { propertyIds, year },
        { responseType: 'blob' }
      )
    );
  }

  // Existing method from 6.1
  downloadPdf(blob: Blob, propertyName: string, year: number): void {
    const sanitizedName = propertyName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/ /g, '-');
    const filename = `Schedule-E-${sanitizedName}-${year}.pdf`;
    this.triggerDownload(blob, filename);
  }

  // NEW: ZIP download
  downloadZip(blob: Blob, year: number): void {
    const filename = `Schedule-E-Reports-${year}.zip`;
    this.triggerDownload(blob, filename);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
```

**Add Reports Route:**
```typescript
// Update features/reports/reports.routes.ts
import { Routes } from '@angular/router';
import { ReportsComponent } from './reports.component';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    component: ReportsComponent
  }
];

// Ensure /reports is added to app.routes.ts if not already present
```

### Previous Story Learnings (From Story 6.1)

**Patterns Established:**
- QuestPDF for PDF generation with Community license
- `IScheduleEPdfGenerator` interface pattern for testability
- ReportService handling blob responses
- MatDialog patterns for report modals
- Year selector integration from YearSelectorStore
- Signal-based component state management

**Key Files from 6.1 to Leverage:**
- `backend/src/PropertyManager.Application/Reports/GenerateScheduleEReport.cs` - Query pattern
- `backend/src/PropertyManager.Infrastructure/Reports/ScheduleEPdfGenerator.cs` - PDF generation
- `backend/src/PropertyManager.Api/Controllers/ReportsController.cs` - Endpoint patterns
- `frontend/src/app/features/reports/services/report.service.ts` - HTTP blob handling
- `frontend/src/app/features/reports/components/report-dialog/` - Dialog patterns

**Code from 6.1 to Reuse:**
- `GenerateScheduleEReportQuery` - Call this for each property in batch
- `ScheduleEPdfGenerator.Generate()` - Generate individual PDFs
- File name sanitization logic in controller
- Year selector dropdown pattern

### Git Intelligence

**Recent Commits:**
```
81eca70 fix(reports): Use explicit USD currency format in PDF reports (#53)
10fc4bc feat(reports): Add Schedule E PDF report generation (#6.1) (#52)
```

These commits establish:
- USD currency formatting in PDFs (use same pattern)
- Report infrastructure is in place and tested
- Controller/service patterns to follow

### Technical Specifics

**System.IO.Compression for ZIP:**
- Built into .NET, no additional packages needed
- ZipArchive creates in-memory ZIP files
- CompressionLevel.Optimal for best size

**Parallel PDF Generation:**
- Use `Task.WhenAll` for concurrent generation
- Each property generates independently
- Collect results and handle partial failures

**Memory Considerations:**
- For 14 properties, in-memory ZIP is fine
- If scaling to hundreds, consider streaming or S3 storage
- Current approach: generate all PDFs, bundle, return

### Project Structure Notes

- Extends existing reports feature from Story 6.1
- ReportBundleService placed in Infrastructure layer (file operations)
- Interface in Application layer for testability
- Batch dialog is separate component from single-property dialog

### Testing Strategy

**Backend Unit Tests:**
```csharp
[Fact]
public async Task Handle_MultipleProperties_GeneratesAllReports()
{
    // Arrange: 3 properties with different data
    // Act: Call batch handler
    // Assert: 3 results, all successful
}

[Fact]
public async Task Handle_PropertyWithNoData_GeneratesZeroReport()
{
    // Arrange: Property with no expenses or income
    // Act: Generate batch
    // Assert: Report generated with $0 values, hasData = false
}

[Fact]
public async Task Handle_OnePropertyFails_OthersSucceed()
{
    // Arrange: Mock one property to fail
    // Act: Generate batch
    // Assert: Failed property has error, others succeed
}

[Fact]
public void CreateZipBundle_MultipleFiles_CreatesValidZip()
{
    // Arrange: List of (filename, bytes) tuples
    // Act: Create ZIP bundle
    // Assert: Valid ZIP with all files, correct names
}
```

**Frontend Unit Tests:**
```typescript
describe('BatchReportDialogComponent', () => {
  it('should load all properties on init', () => {
    // Verify properties loaded from store
  });

  it('should toggle individual property selection', () => {
    // Click checkbox, verify state updates
  });

  it('should toggle all properties', () => {
    // Click select all, verify all checked
  });

  it('should update button count when selection changes', () => {
    // Select 5 of 14, verify button shows "(5 Reports)"
  });

  it('should trigger ZIP download on success', async () => {
    // Mock successful batch generation
    // Verify downloadZip called
  });
});
```

### DI Registration

```csharp
// Infrastructure/DependencyInjection.cs
public static IServiceCollection AddInfrastructure(this IServiceCollection services)
{
    // ... existing registrations
    services.AddScoped<IReportBundleService, ReportBundleService>();
    // ...
}
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2: Generate Schedule E PDFs for All Properties]
- [Source: _bmad-output/planning-artifacts/prd.md#Tax Reporting - FR50]
- [Source: _bmad-output/planning-artifacts/architecture.md#Reports]
- [Source: _bmad-output/implementation-artifacts/6-1-generate-schedule-e-pdf-for-single-property.md]
- [System.IO.Compression.ZipArchive](https://docs.microsoft.com/en-us/dotnet/api/system.io.compression.ziparchive)
- [QuestPDF Documentation](https://www.questpdf.com)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Implementation uses sequential generation instead of parallel due to DbContext thread-safety (scoped DbContext cannot be shared across parallel MediatR calls)
- Deleted unused FluentValidation validators (GenerateBatchScheduleEReportsValidator.cs, GenerateScheduleEReportValidator.cs) - controller uses manual validation instead
- All unit tests passing (backend: 8/8, frontend: 578/578)

### File List

**Backend - New Files:**
- `backend/src/PropertyManager.Application/Reports/GenerateBatchScheduleEReports.cs` - Batch query, DTOs, and handler
- `backend/src/PropertyManager.Application/Common/Interfaces/IReportBundleService.cs` - ZIP bundle interface
- `backend/src/PropertyManager.Infrastructure/Reports/ReportBundleService.cs` - ZIP creation implementation
- `backend/tests/PropertyManager.Application.Tests/Reports/GenerateBatchScheduleEReportsHandlerTests.cs` - Handler unit tests
- `backend/tests/PropertyManager.Infrastructure.Tests/Reports/ReportBundleServiceTests.cs` - Bundle service tests

**Backend - Modified Files:**
- `backend/src/PropertyManager.Api/Controllers/ReportsController.cs` - Added batch endpoint
- `backend/src/PropertyManager.Api/Program.cs` - Registered IReportBundleService

**Frontend - New Files:**
- `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.ts` - Batch dialog component
- `frontend/src/app/features/reports/components/batch-report-dialog/batch-report-dialog.component.spec.ts` - Dialog tests
- `frontend/e2e/pages/reports.page.ts` - E2E page object

**Frontend - Modified Files:**
- `frontend/src/app/features/reports/reports.component.ts` - Added batch button
- `frontend/src/app/features/reports/services/report.service.ts` - Added batch methods
- `frontend/src/app/features/reports/services/report.service.spec.ts` - Added batch tests
- `frontend/src/app/core/api/api.service.ts` - Generated API client update
- `frontend/e2e/tests/reports/report-flow.spec.ts` - Added batch E2E tests
