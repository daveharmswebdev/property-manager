import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ReceiptUploadDialogComponent } from './receipt-upload-dialog.component';

describe('ReceiptUploadDialogComponent', () => {
  let component: ReceiptUploadDialogComponent;
  let fixture: ComponentFixture<ReceiptUploadDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ReceiptUploadDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptUploadDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render dialog with DragDropUpload component', () => {
    const dragDrop = fixture.debugElement.query(By.css('app-drag-drop-upload'));
    expect(dragDrop).toBeTruthy();
  });

  it('should render dialog title "Upload Receipts"', () => {
    const title = fixture.debugElement.query(By.css('[mat-dialog-title]'));
    expect(title.nativeElement.textContent).toContain('Upload Receipts');
  });

  it('should have Upload button disabled when no files selected', () => {
    const uploadBtn = fixture.debugElement.query(
      By.css('[data-testid="dialog-upload-btn"]')
    );
    expect(uploadBtn.nativeElement.disabled).toBe(true);
  });

  it('should enable Upload button when files are selected', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    component.onFilesSelected([file]);
    fixture.detectChanges();

    const uploadBtn = fixture.debugElement.query(
      By.css('[data-testid="dialog-upload-btn"]')
    );
    expect(uploadBtn.nativeElement.disabled).toBe(false);
  });

  it('should close dialog with null on Cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(null);
  });

  it('should close dialog with selected files on Upload', () => {
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    component.onFilesSelected(files);
    component.onUpload();

    expect(mockDialogRef.close).toHaveBeenCalledWith(files);
  });
});
