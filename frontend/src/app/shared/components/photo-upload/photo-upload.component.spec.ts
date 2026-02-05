import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PhotoUploadComponent } from './photo-upload.component';
import { PhotoUploadService } from '../../services/photo-upload.service';

// Mock DataTransfer for JSDom environment
interface MockDataTransfer {
  files: FileList;
}

function createMockDataTransfer(file: File): MockDataTransfer {
  const fileList = {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file;
    },
  } as unknown as FileList;
  return { files: fileList };
}

// Helper to create mock DragEvent (not available in JSDom)
function createMockDragEvent(type: string, dataTransfer?: MockDataTransfer): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  (event as any).dataTransfer = dataTransfer;
  return event;
}

describe('PhotoUploadComponent', () => {
  let component: PhotoUploadComponent;
  let fixture: ComponentFixture<PhotoUploadComponent>;
  let mockUploadFn: ReturnType<typeof vi.fn>;
  let mockPhotoUploadService: Partial<PhotoUploadService>;

  beforeEach(async () => {
    mockUploadFn = vi.fn();
    mockPhotoUploadService = {
      isValidFileType: vi.fn().mockReturnValue(true),
      isValidFileSize: vi.fn().mockReturnValue(true),
      getAcceptString: vi.fn().mockReturnValue('image/jpeg,image/png,image/gif,image/webp'),
      getMaxFileSizeBytes: vi.fn().mockReturnValue(10 * 1024 * 1024),
    };

    await TestBed.configureTestingModule({
      imports: [PhotoUploadComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PhotoUploadService, useValue: mockPhotoUploadService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoUploadComponent);
    component = fixture.componentInstance;
    // Set required input
    fixture.componentRef.setInput('uploadFn', mockUploadFn);
    fixture.detectChanges();
  });

  describe('Rendering', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should render drop zone', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const dropZone = compiled.querySelector('[data-testid="drop-zone"]');
      expect(dropZone).toBeTruthy();
    });

    it('should render file input', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const fileInput = compiled.querySelector('[data-testid="file-input"]');
      expect(fileInput).toBeTruthy();
    });

    it('should show idle state by default', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Drag & drop a photo here');
      expect(compiled.textContent).toContain('or click to browse');
    });

    it('should display accepted file info', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Accepts: JPEG, PNG, GIF, WebP');
      expect(compiled.textContent).toContain('max 10MB');
    });
  });

  describe('File Validation', () => {
    it('should show validation error for invalid file type', () => {
      (mockPhotoUploadService.isValidFileType as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const file = new File([''], 'test.txt', { type: 'text/plain' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const validationError = compiled.querySelector('[data-testid="validation-error"]');
      expect(validationError).toBeTruthy();
      expect(validationError?.textContent).toContain('Invalid file type');
    });

    it('should show validation error for file too large', () => {
      (mockPhotoUploadService.isValidFileSize as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const file = new File(['test'], 'large.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const validationError = compiled.querySelector('[data-testid="validation-error"]');
      expect(validationError).toBeTruthy();
      expect(validationError?.textContent).toContain('File too large');
    });

    it('should not show validation error for valid file', async () => {
      mockUploadFn.mockResolvedValue(true);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const validationError = compiled.querySelector('[data-testid="validation-error"]');
      expect(validationError).toBeFalsy();

      // Wait for upload to complete
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('success');
      });
    });
  });

  describe('Upload Progress', () => {
    it('should show uploading state during upload', async () => {
      let resolveUpload: (value: boolean) => void;
      const uploadPromise = new Promise<boolean>(resolve => {
        resolveUpload = resolve;
      });
      mockUploadFn.mockReturnValue(uploadPromise);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Uploading...');
      expect(compiled.querySelector('[data-testid="progress-bar"]')).toBeTruthy();

      // Complete the upload
      resolveUpload!(true);
      await uploadPromise;
      fixture.detectChanges();
    });

    it('should show progress text during upload', async () => {
      let resolveUpload: (value: boolean) => void;
      const uploadPromise = new Promise<boolean>(resolve => {
        resolveUpload = resolve;
      });
      mockUploadFn.mockReturnValue(uploadPromise);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      fixture.detectChanges();

      const progressText = fixture.nativeElement.querySelector('[data-testid="progress-text"]');
      expect(progressText).toBeTruthy();

      // Complete the upload
      resolveUpload!(true);
      await uploadPromise;
    });
  });

  describe('Upload Success', () => {
    it('should show success state after successful upload', async () => {
      mockUploadFn.mockResolvedValue(true);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for upload to complete
      await vi.waitFor(() => {
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('Upload complete!');
      });

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="upload-another-btn"]')).toBeTruthy();
    });

    it('should emit uploadComplete on success', async () => {
      mockUploadFn.mockResolvedValue(true);
      const uploadCompleteSpy = vi.fn();
      component.uploadComplete.subscribe(uploadCompleteSpy);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for upload to complete
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(uploadCompleteSpy).toHaveBeenCalled();
      });
    });

    it('should allow uploading another photo after success', async () => {
      mockUploadFn.mockResolvedValue(true);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for upload to complete
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('success');
      });

      const uploadAnotherBtn = fixture.nativeElement.querySelector('[data-testid="upload-another-btn"]');
      uploadAnotherBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Drag & drop a photo here');
    });
  });

  describe('Error Handling', () => {
    it('should show error state when upload fails', async () => {
      mockUploadFn.mockResolvedValue(false);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for upload to fail
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('error');
      });

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Upload failed');
      expect(compiled.querySelector('[data-testid="retry-btn"]')).toBeTruthy();
      expect(compiled.querySelector('[data-testid="cancel-btn"]')).toBeTruthy();
    });

    it('should show error message when upload throws', async () => {
      mockUploadFn.mockRejectedValue(new Error('Network error'));

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for upload to fail
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('error');
      });

      const errorMessage = fixture.nativeElement.querySelector('[data-testid="error-message"]');
      expect(errorMessage?.textContent).toContain('Network error');
    });

    it('should allow retry after error', async () => {
      mockUploadFn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for first upload to fail
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('error');
      });

      const retryBtn = fixture.nativeElement.querySelector('[data-testid="retry-btn"]');
      retryBtn.click();

      // Wait for retry to succeed
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('success');
      });

      expect(fixture.nativeElement.textContent).toContain('Upload complete!');
    });

    it('should allow cancel after error', async () => {
      mockUploadFn.mockResolvedValue(false);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = createMockDataTransfer(file);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      const dropEvent = createMockDragEvent('drop', dataTransfer);
      dropZone.dispatchEvent(dropEvent);

      // Wait for upload to fail
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.uploadState().status).toBe('error');
      });

      const cancelBtn = fixture.nativeElement.querySelector('[data-testid="cancel-btn"]');
      cancelBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Drag & drop a photo here');
    });
  });

  describe('Drag and Drop', () => {
    it('should add dragging class on dragover', () => {
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');

      const dragOverEvent = createMockDragEvent('dragover');
      dropZone.dispatchEvent(dragOverEvent);

      fixture.detectChanges();

      expect(dropZone.classList.contains('dragging')).toBe(true);
    });

    it('should remove dragging class on dragleave', () => {
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');

      const dragOverEvent = createMockDragEvent('dragover');
      dropZone.dispatchEvent(dragOverEvent);
      fixture.detectChanges();

      const dragLeaveEvent = createMockDragEvent('dragleave');
      dropZone.dispatchEvent(dragLeaveEvent);
      fixture.detectChanges();

      expect(dropZone.classList.contains('dragging')).toBe(false);
    });
  });
});
