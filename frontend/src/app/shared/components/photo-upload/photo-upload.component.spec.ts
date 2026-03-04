import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PhotoUploadComponent } from './photo-upload.component';
import { PhotoUploadService } from '../../services/photo-upload.service';

// Mock DataTransfer for JSDom environment — supports multiple files (Task 7.1)
interface MockDataTransfer {
  files: FileList;
}

function createMockDataTransfer(...files: File[]): MockDataTransfer {
  const fileList = {
    ...files.reduce(
      (acc, file, index) => {
        acc[index] = file;
        return acc;
      },
      {} as Record<number, File>,
    ),
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
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

function createFile(name: string, type = 'image/jpeg'): File {
  return new File(['test'], name, { type });
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
    fixture.componentRef.setInput('uploadFn', mockUploadFn);
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
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

    it('should show idle state by default with plural text', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Drag & drop photos here');
      expect(compiled.textContent).toContain('or click to browse');
    });

    it('should display accepted file info', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Accepts: JPEG, PNG, GIF, WebP');
      expect(compiled.textContent).toContain('max 10MB');
    });

    // Task 7.13
    it('should have multiple attribute on file input', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const fileInput = compiled.querySelector('[data-testid="file-input"]') as HTMLInputElement;
      expect(fileInput.hasAttribute('multiple')).toBe(true);
    });

    // Task 7.14
    it('should NOT have capture attribute on file input', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const fileInput = compiled.querySelector('[data-testid="file-input"]') as HTMLInputElement;
      expect(fileInput.hasAttribute('capture')).toBe(false);
    });
  });

  describe('Multi-file drop (Task 7.2)', () => {
    it('should add all valid files to the queue on drop', async () => {
      let resolveFirst!: (v: boolean) => void;
      let resolveSecond!: (v: boolean) => void;
      let resolveThird!: (v: boolean) => void;
      mockUploadFn
        .mockReturnValueOnce(new Promise<boolean>((r) => (resolveFirst = r)))
        .mockReturnValueOnce(new Promise<boolean>((r) => (resolveSecond = r)))
        .mockReturnValueOnce(new Promise<boolean>((r) => (resolveThird = r)));

      const files = [createFile('a.jpg'), createFile('b.jpg'), createFile('c.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));
      fixture.detectChanges();

      // All 3 files should be in the queue
      expect(component.totalCount()).toBe(3);
      // First file should be uploading
      expect(component.isProcessing()).toBe(true);

      // Complete uploads sequentially
      resolveFirst(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });

      resolveSecond(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(2);
      });

      resolveThird(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(3);
      });

      expect(mockUploadFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Multi-file select (Task 7.3)', () => {
    it('should add all files via file input selection', async () => {
      mockUploadFn.mockResolvedValue(true);

      const files = [createFile('a.jpg'), createFile('b.jpg'), createFile('c.jpg')];
      const fileInput = fixture.nativeElement.querySelector(
        '[data-testid="file-input"]',
      ) as HTMLInputElement;

      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: {
          0: files[0],
          1: files[1],
          2: files[2],
          length: 3,
          item: (i: number) => files[i] ?? null,
          [Symbol.iterator]: function* () {
            for (const f of files) yield f;
          },
        },
        writable: true,
      });

      fileInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.totalCount()).toBe(3);

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(3);
      });
    });
  });

  describe('Individual validation — invalid type (Task 7.4)', () => {
    it('should upload valid files and show error for invalid type', async () => {
      (mockPhotoUploadService.isValidFileType as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockUploadFn.mockResolvedValue(true);

      const files = [createFile('a.jpg'), createFile('b.txt', 'text/plain'), createFile('c.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(2);
      });

      expect(component.failedCount()).toBe(1);
      expect(mockUploadFn).toHaveBeenCalledTimes(2);

      const errorItem = component.uploadQueue().find((i) => i.status === 'error');
      expect(errorItem).toBeTruthy();
      expect(errorItem!.error).toContain('Invalid file type');
    });
  });

  describe('Individual validation — oversized (Task 7.5)', () => {
    it('should upload valid files and show error for oversized file', async () => {
      (mockPhotoUploadService.isValidFileSize as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockUploadFn.mockResolvedValue(true);

      const files = [createFile('a.jpg'), createFile('big.jpg'), createFile('c.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(2);
      });

      expect(component.failedCount()).toBe(1);
      const errorItem = component.uploadQueue().find((i) => i.status === 'error');
      expect(errorItem!.error).toContain('File too large');
    });
  });

  describe('Per-file progress (Task 7.6)', () => {
    it('should show progress for the uploading item', async () => {
      let resolveUpload!: (v: boolean) => void;
      mockUploadFn.mockReturnValue(new Promise<boolean>((r) => (resolveUpload = r)));

      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));
      fixture.detectChanges();

      // Allow progress interval to tick
      await vi.waitFor(() => {
        fixture.detectChanges();
        const uploading = component.uploadQueue().find((i) => i.status === 'uploading');
        expect(uploading).toBeTruthy();
        expect(uploading!.progress).toBeGreaterThan(0);
      });

      resolveUpload(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });
    });
  });

  describe('uploadComplete per file (Task 7.7)', () => {
    it('should emit uploadComplete for each successful file', async () => {
      mockUploadFn.mockResolvedValue(true);
      const uploadCompleteSpy = vi.fn();
      component.uploadComplete.subscribe(uploadCompleteSpy);

      const files = [createFile('a.jpg'), createFile('b.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(uploadCompleteSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('batchComplete (Task 7.8)', () => {
    it('should emit batchComplete once after all files processed', async () => {
      mockUploadFn.mockResolvedValue(true);
      const batchCompleteSpy = vi.fn();
      component.batchComplete.subscribe(batchCompleteSpy);

      const files = [createFile('a.jpg'), createFile('b.jpg'), createFile('c.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(batchCompleteSpy).toHaveBeenCalledTimes(1);
      });

      expect(component.completedCount()).toBe(3);
    });

    it('should NOT emit batchComplete when all files fail validation', () => {
      (mockPhotoUploadService.isValidFileType as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const batchCompleteSpy = vi.fn();
      component.batchComplete.subscribe(batchCompleteSpy);

      const files = [createFile('a.txt', 'text/plain'), createFile('b.txt', 'text/plain')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));
      fixture.detectChanges();

      // All files failed validation — batchComplete should NOT fire
      expect(component.failedCount()).toBe(2);
      expect(batchCompleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('Retry failed item (Task 7.9)', () => {
    it('should retry a failed item and upload successfully', async () => {
      mockUploadFn.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      // Wait for first attempt to fail
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.failedCount()).toBe(1);
      });

      // Retry the failed item
      const failedItem = component.uploadQueue().find((i) => i.status === 'error');
      component.retryItem(failedItem!.id);

      // Wait for retry to succeed
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });

      expect(component.failedCount()).toBe(0);
    });
  });

  describe('Remove pending item (Task 7.10)', () => {
    it('should remove an item from the queue', async () => {
      let resolveUpload!: (v: boolean) => void;
      mockUploadFn.mockReturnValue(new Promise<boolean>((r) => (resolveUpload = r)));

      const files = [createFile('a.jpg'), createFile('b.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));
      fixture.detectChanges();

      // First is uploading, second is pending
      expect(component.totalCount()).toBe(2);
      const pendingItem = component.uploadQueue().find((i) => i.status === 'pending');
      expect(pendingItem).toBeTruthy();

      // Remove the pending item
      component.removeItem(pendingItem!.id);
      expect(component.totalCount()).toBe(1);

      resolveUpload(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });
    });
  });

  describe('Clear queue (Task 7.11)', () => {
    it('should reset to idle state when queue is cleared', async () => {
      mockUploadFn.mockResolvedValue(true);
      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });

      component.clearQueue();
      fixture.detectChanges();

      expect(component.hasQueue()).toBe(false);
      expect(component.totalCount()).toBe(0);

      // Should show idle state again
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Drag & drop photos here');
    });
  });

  describe('Single file backward compatibility (Task 7.12)', () => {
    it('should handle single file drop normally', async () => {
      mockUploadFn.mockResolvedValue(true);
      const uploadCompleteSpy = vi.fn();
      const batchCompleteSpy = vi.fn();
      component.uploadComplete.subscribe(uploadCompleteSpy);
      component.batchComplete.subscribe(batchCompleteSpy);

      const dataTransfer = createMockDataTransfer(createFile('photo.jpg'));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });

      expect(uploadCompleteSpy).toHaveBeenCalledTimes(1);
      expect(batchCompleteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Add files during upload (Task 7.15)', () => {
    it('should allow adding more files while upload in progress', async () => {
      let resolveFirst!: (v: boolean) => void;
      mockUploadFn
        .mockReturnValueOnce(new Promise<boolean>((r) => (resolveFirst = r)))
        .mockResolvedValue(true);

      // Drop first file
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', createMockDataTransfer(createFile('a.jpg'))));
      fixture.detectChanges();

      expect(component.isProcessing()).toBe(true);
      expect(component.totalCount()).toBe(1);

      // Drop second file while first is uploading — queue grows
      // After adding to queue, the compact drop zone is used
      fixture.detectChanges();
      const compactDropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      compactDropZone.dispatchEvent(
        createMockDragEvent('drop', createMockDataTransfer(createFile('b.jpg'))),
      );
      fixture.detectChanges();

      expect(component.totalCount()).toBe(2);

      // Complete first upload
      resolveFirst(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        // Both should eventually complete
        expect(component.completedCount()).toBe(2);
      });
    });
  });

  describe('Drop zone interactive during uploads (Task 7.16)', () => {
    it('should not block drop zone during active uploads', async () => {
      let resolveUpload!: (v: boolean) => void;
      mockUploadFn.mockReturnValue(new Promise<boolean>((r) => (resolveUpload = r)));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', createMockDataTransfer(createFile('a.jpg'))));
      fixture.detectChanges();

      // Upload is in progress
      expect(component.isProcessing()).toBe(true);

      // Dragover should still work (isDragging should update)
      fixture.detectChanges();
      const activeDropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      activeDropZone.dispatchEvent(createMockDragEvent('dragover'));
      fixture.detectChanges();

      expect(component.isDragging()).toBe(true);

      resolveUpload(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should add dragging class on dragover', () => {
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');

      dropZone.dispatchEvent(createMockDragEvent('dragover'));
      fixture.detectChanges();

      expect(dropZone.classList.contains('dragging')).toBe(true);
    });

    it('should remove dragging class on dragleave', () => {
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');

      dropZone.dispatchEvent(createMockDragEvent('dragover'));
      fixture.detectChanges();

      dropZone.dispatchEvent(createMockDragEvent('dragleave'));
      fixture.detectChanges();

      expect(dropZone.classList.contains('dragging')).toBe(false);
    });
  });

  describe('Retry cooldown (Issue 2)', () => {
    it('should prevent rapid retries on the same item', async () => {
      mockUploadFn.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.failedCount()).toBe(1);
      });

      const failedItem = component.uploadQueue().find((i) => i.status === 'error');
      component.retryItem(failedItem!.id);

      // Second immediate retry should be blocked by cooldown
      component.retryItem(failedItem!.id);

      await vi.waitFor(() => {
        fixture.detectChanges();
        // Only one retry attempt should have happened (2 total calls to uploadFn)
        expect(mockUploadFn).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Max file count guard (Issue 7)', () => {
    it('should cap files at MAX_FILES_PER_BATCH', () => {
      const maxFiles = PhotoUploadComponent.MAX_FILES_PER_BATCH;
      mockUploadFn.mockReturnValue(new Promise<boolean>(() => {})); // never resolve

      const files = Array.from({ length: maxFiles + 5 }, (_, i) => createFile(`file-${i}.jpg`));
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));
      fixture.detectChanges();

      expect(component.totalCount()).toBe(maxFiles);
    });
  });

  describe('Error Handling', () => {
    it('should show error state when upload throws', async () => {
      mockUploadFn.mockRejectedValue(new Error('Network error'));

      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.failedCount()).toBe(1);
      });

      const errorItem = component.uploadQueue().find((i) => i.status === 'error');
      expect(errorItem!.error).toContain('Network error');
    });
  });

  describe('Queue UI', () => {
    it('should show compact drop zone when queue has items', async () => {
      let resolveUpload!: (v: boolean) => void;
      mockUploadFn.mockReturnValue(new Promise<boolean>((r) => (resolveUpload = r)));

      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));
      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Drop more photos or click to add');
      expect(compiled.querySelector('[data-testid="upload-queue"]')).toBeTruthy();
      expect(compiled.querySelector('[data-testid="queue-summary"]')).toBeTruthy();

      resolveUpload(true);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(1);
      });
    });

    it('should show clear button when all items in final state', async () => {
      mockUploadFn.mockResolvedValue(true);
      const dataTransfer = createMockDataTransfer(createFile('a.jpg'));

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.allInFinalState()).toBe(true);
      });

      const clearBtn = fixture.nativeElement.querySelector('[data-testid="clear-queue-btn"]');
      expect(clearBtn).toBeTruthy();
    });

    it('should show summary text', async () => {
      mockUploadFn.mockResolvedValue(true);
      const files = [createFile('a.jpg'), createFile('b.jpg')];
      const dataTransfer = createMockDataTransfer(...files);

      const dropZone = fixture.nativeElement.querySelector('[data-testid="drop-zone"]');
      dropZone.dispatchEvent(createMockDragEvent('drop', dataTransfer));

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(component.completedCount()).toBe(2);
      });

      const summary = fixture.nativeElement.querySelector('[data-testid="queue-summary"]');
      expect(summary?.textContent).toContain('All 2 uploaded successfully');
    });
  });
});
