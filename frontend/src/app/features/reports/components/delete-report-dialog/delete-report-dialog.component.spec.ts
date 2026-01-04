import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DeleteReportDialogComponent, DeleteReportDialogData } from './delete-report-dialog.component';
import { GeneratedReportDto } from '../../../../core/api/api.service';

describe('DeleteReportDialogComponent', () => {
  let component: DeleteReportDialogComponent;
  let fixture: ComponentFixture<DeleteReportDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<DeleteReportDialogComponent>>;

  const mockReport: GeneratedReportDto = {
    id: 'report-123',
    displayName: 'Test Property',
    year: 2024,
    generatedAt: new Date('2024-01-15'),
    fileName: 'Schedule-E-Test-Property-2024.pdf',
    fileType: 'PDF',
    fileSizeBytes: 12345,
  };

  const mockDialogData: DeleteReportDialogData = {
    report: mockReport,
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DeleteReportDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('display', () => {
    it('should display report name', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Test Property');
    });

    it('should display report year', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('2024');
    });

    it('should display report filename', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Schedule-E-Test-Property-2024.pdf');
    });

    it('should display warning message', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('This action cannot be undone');
    });

    it('should display delete title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Delete Report?');
    });
  });

  describe('buttons', () => {
    it('should have cancel button', () => {
      const cancelBtn = fixture.nativeElement.querySelector('[data-testid="cancel-delete-btn"]');
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn.textContent).toContain('Cancel');
    });

    it('should have confirm delete button', () => {
      const confirmBtn = fixture.nativeElement.querySelector('[data-testid="confirm-delete-btn"]');
      expect(confirmBtn).toBeTruthy();
      expect(confirmBtn.textContent).toContain('Delete Report');
    });
  });
});
