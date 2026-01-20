import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyPhotoUploadComponent } from './property-photo-upload.component';
import { PhotoUploadService, PhotoUploadResult } from '../../../../shared/services/photo-upload.service';
import { provideAnimations } from '@angular/platform-browser/animations';

describe('PropertyPhotoUploadComponent', () => {
  let component: PropertyPhotoUploadComponent;
  let fixture: ComponentFixture<PropertyPhotoUploadComponent>;
  let mockPhotoUploadService: {
    uploadPhoto: ReturnType<typeof vi.fn>;
    isValidFileType: ReturnType<typeof vi.fn>;
    isValidFileSize: ReturnType<typeof vi.fn>;
    getAcceptString: ReturnType<typeof vi.fn>;
    getMaxFileSizeBytes: ReturnType<typeof vi.fn>;
  };

  const createMockFile = (name: string, type: string): File => {
    const blob = new Blob(['test content'], { type });
    return new File([blob], name, { type });
  };

  const mockUploadResult: PhotoUploadResult = {
    storageKey: 'photos/property-123/abc123.jpg',
    thumbnailStorageKey: 'photos/property-123/thumbs/abc123.jpg',
    contentType: 'image/jpeg',
    fileSizeBytes: 1024000,
  };

  beforeEach(async () => {
    mockPhotoUploadService = {
      uploadPhoto: vi.fn(),
      isValidFileType: vi.fn().mockReturnValue(true),
      isValidFileSize: vi.fn().mockReturnValue(true),
      getAcceptString: vi.fn().mockReturnValue('image/jpeg,image/png,image/gif,image/webp'),
      getMaxFileSizeBytes: vi.fn().mockReturnValue(10 * 1024 * 1024),
    };

    await TestBed.configureTestingModule({
      imports: [PropertyPhotoUploadComponent],
      providers: [
        provideAnimations(),
        { provide: PhotoUploadService, useValue: mockPhotoUploadService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyPhotoUploadComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('propertyId', 'property-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Idle State', () => {
    it('should show upload icon and instructions in idle state', () => {
      const uploadIcon = fixture.nativeElement.querySelector('.upload-icon');
      const dropText = fixture.nativeElement.querySelector('.drop-text');

      expect(uploadIcon.textContent).toContain('cloud_upload');
      expect(dropText.textContent).toContain('Drag & drop');
    });

    it('should show file type info', () => {
      const fileInfo = fixture.nativeElement.querySelector('.file-info');
      expect(fileInfo.textContent).toContain('JPEG, PNG, GIF, WebP');
      expect(fileInfo.textContent).toContain('10MB');
    });
  });

  describe('Drag and Drop (AC-13.3b.7)', () => {
    it('should set dragging state on dragover', () => {
      component.onDragOver({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent);
      fixture.detectChanges();

      expect(component.isDragging()).toBe(true);
      const dropZone = fixture.nativeElement.querySelector('.drop-zone');
      expect(dropZone.classList.contains('dragging')).toBe(true);
    });

    it('should clear dragging state on dragleave', () => {
      component.isDragging.set(true);
      fixture.detectChanges();

      component.onDragLeave({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent);
      fixture.detectChanges();

      expect(component.isDragging()).toBe(false);
    });

    it('should not set dragging when uploading', () => {
      component.uploadState.set({ status: 'uploading', progress: 50, error: null, file: null });
      component.onDragOver({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent);
      fixture.detectChanges();

      expect(component.isDragging()).toBe(false);
    });
  });

  describe('File Selection', () => {
    it('should have hidden file input', () => {
      const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
      expect(fileInput.hidden).toBe(true);
    });

    it('should accept correct file types', () => {
      const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
      expect(fileInput.accept).toContain('image/jpeg');
    });
  });

  describe('Client-side Validation (AC-13.3b.7)', () => {
    it('should show validation error for invalid file type', () => {
      mockPhotoUploadService.isValidFileType.mockReturnValue(false);

      const file = createMockFile('test.txt', 'text/plain');
      component['handleFile'](file);
      fixture.detectChanges();

      const validationError = fixture.nativeElement.querySelector('.validation-error');
      expect(validationError).toBeTruthy();
      expect(validationError.textContent).toContain('Invalid file type');
    });

    it('should show validation error for file too large', () => {
      mockPhotoUploadService.isValidFileType.mockReturnValue(true);
      mockPhotoUploadService.isValidFileSize.mockReturnValue(false);

      const file = createMockFile('large.jpg', 'image/jpeg');
      component['handleFile'](file);
      fixture.detectChanges();

      const validationError = fixture.nativeElement.querySelector('.validation-error');
      expect(validationError).toBeTruthy();
      expect(validationError.textContent).toContain('File too large');
    });

    it('should not start upload for invalid file', () => {
      mockPhotoUploadService.isValidFileType.mockReturnValue(false);

      const file = createMockFile('test.txt', 'text/plain');
      component['handleFile'](file);

      expect(mockPhotoUploadService.uploadPhoto).not.toHaveBeenCalled();
    });
  });

  describe('Upload Progress (AC-13.3b.7)', () => {
    it('should show progress bar during upload', async () => {
      let progressCallback: ((p: number) => void) | undefined;
      mockPhotoUploadService.uploadPhoto.mockImplementation(
        (_file: File, options: { onProgress?: (p: number) => void }) => {
          progressCallback = options.onProgress;
          return new Promise(() => {}); // Never resolves
        }
      );

      const file = createMockFile('test.jpg', 'image/jpeg');
      component['handleFile'](file);
      fixture.detectChanges();

      expect(component.uploadState().status).toBe('uploading');

      const progressBar = fixture.nativeElement.querySelector('mat-progress-bar');
      expect(progressBar).toBeTruthy();

      // Simulate progress
      progressCallback?.(50);
      fixture.detectChanges();
      expect(component.uploadState().progress).toBe(50);
    });

    it('should show spinning icon during upload', () => {
      mockPhotoUploadService.uploadPhoto.mockImplementation(() => new Promise(() => {}));

      const file = createMockFile('test.jpg', 'image/jpeg');
      component['handleFile'](file);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.upload-icon');
      expect(icon.classList.contains('spinning')).toBe(true);
      expect(icon.textContent).toContain('sync');
    });
  });

  describe('Upload Success', () => {
    it('should show success state after upload completes', async () => {
      mockPhotoUploadService.uploadPhoto.mockResolvedValue(mockUploadResult);

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      expect(component.uploadState().status).toBe('success');

      const icon = fixture.nativeElement.querySelector('.upload-icon');
      expect(icon.textContent).toContain('check_circle');
    });

    it('should emit uploadComplete on success', async () => {
      mockPhotoUploadService.uploadPhoto.mockResolvedValue(mockUploadResult);

      const uploadCompleteSpy = vi.fn();
      component.uploadComplete.subscribe(uploadCompleteSpy);

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);

      expect(uploadCompleteSpy).toHaveBeenCalledWith(mockUploadResult);
    });

    it('should show "Upload Another" button on success', async () => {
      mockPhotoUploadService.uploadPhoto.mockResolvedValue(mockUploadResult);

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.textContent).toContain('Upload Another');
    });
  });

  describe('Error State (AC-13.3b.8)', () => {
    it('should show error state on upload failure', async () => {
      mockPhotoUploadService.uploadPhoto.mockRejectedValue(new Error('Network error'));

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      expect(component.uploadState().status).toBe('error');

      const icon = fixture.nativeElement.querySelector('.upload-icon');
      expect(icon.classList.contains('error')).toBe(true);
    });

    it('should show error message', async () => {
      mockPhotoUploadService.uploadPhoto.mockRejectedValue(new Error('Network error'));

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      const errorMessage = fixture.nativeElement.querySelector('.error-message');
      expect(errorMessage.textContent).toContain('Network error');
    });

    it('should show retry button on error', async () => {
      mockPhotoUploadService.uploadPhoto.mockRejectedValue(new Error('Network error'));

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      const retryButton = fixture.nativeElement.querySelector('.error-actions button');
      expect(retryButton.textContent).toContain('Retry');
    });

    it('should retry upload when retry button clicked', async () => {
      mockPhotoUploadService.uploadPhoto
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockUploadResult);

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      // Click retry
      component.retryUpload({ stopPropagation: vi.fn() } as unknown as Event);
      await vi.waitFor(() => expect(mockPhotoUploadService.uploadPhoto).toHaveBeenCalledTimes(2));
      fixture.detectChanges();

      expect(component.uploadState().status).toBe('success');
    });
  });

  describe('Reset', () => {
    it('should reset to idle state when reset is called', async () => {
      mockPhotoUploadService.uploadPhoto.mockResolvedValue(mockUploadResult);

      const file = createMockFile('test.jpg', 'image/jpeg');
      await component['startUpload'](file);
      fixture.detectChanges();

      component.resetUpload({ stopPropagation: vi.fn() } as unknown as Event);
      fixture.detectChanges();

      expect(component.uploadState().status).toBe('idle');
    });
  });
});
