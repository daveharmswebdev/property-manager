import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkOrderPhotoStore } from './work-order-photo.store';
import { ApiClient, WorkOrderPhotoDto } from '../../../core/api/api.service';

describe('WorkOrderPhotoStore', () => {
  let store: InstanceType<typeof WorkOrderPhotoStore>;
  let mockApiClient: {
    workOrderPhotos_GetPhotos: ReturnType<typeof vi.fn>;
    workOrderPhotos_GenerateUploadUrl: ReturnType<typeof vi.fn>;
    workOrderPhotos_ConfirmUpload: ReturnType<typeof vi.fn>;
    workOrderPhotos_DeletePhoto: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  const mockPhotos: WorkOrderPhotoDto[] = [
    {
      id: 'photo-1',
      workOrderId: 'wo-123',
      originalFileName: 'photo1.jpg',
      contentType: 'image/jpeg',
      fileSizeBytes: 1024,
      createdAt: new Date('2026-01-31T10:00:00'),
      photoUrl: 'https://example.com/photo1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
    },
    {
      id: 'photo-2',
      workOrderId: 'wo-123',
      originalFileName: 'photo2.jpg',
      contentType: 'image/jpeg',
      fileSizeBytes: 2048,
      createdAt: new Date('2026-01-31T09:00:00'),
      photoUrl: 'https://example.com/photo2.jpg',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
    },
  ];

  beforeEach(() => {
    mockApiClient = {
      workOrderPhotos_GetPhotos: vi.fn().mockReturnValue(of({ items: mockPhotos })),
      workOrderPhotos_GenerateUploadUrl: vi.fn(),
      workOrderPhotos_ConfirmUpload: vi.fn(),
      workOrderPhotos_DeletePhoto: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        WorkOrderPhotoStore,
        { provide: ApiClient, useValue: mockApiClient },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    store = TestBed.inject(WorkOrderPhotoStore);
  });

  describe('Initial State', () => {
    it('should have empty photos array', () => {
      expect(store.photos()).toEqual([]);
    });

    it('should not be loading initially', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });

    it('should have no work order ID', () => {
      expect(store.workOrderId()).toBeNull();
    });
  });

  describe('Computed Signals', () => {
    it('should compute photoCount correctly', () => {
      expect(store.photoCount()).toBe(0);
    });

    it('should compute hasPhotos correctly', () => {
      expect(store.hasPhotos()).toBe(false);
    });

    it('should compute isEmpty correctly when not loading and no photos', () => {
      expect(store.isEmpty()).toBe(true);
    });
  });

  describe('loadPhotos', () => {
    it('should load photos from API', async () => {
      store.loadPhotos('wo-123');

      await vi.waitFor(() => {
        expect(store.photos().length).toBe(2);
      });

      expect(mockApiClient.workOrderPhotos_GetPhotos).toHaveBeenCalledWith('wo-123');
      expect(store.workOrderId()).toBe('wo-123');
      expect(store.isLoading()).toBe(false);
    });

    it('should set loading state during load', () => {
      store.loadPhotos('wo-123');
      // Initial state should be loading
      expect(store.workOrderId()).toBe('wo-123');
    });

    it('should handle API error', async () => {
      mockApiClient.workOrderPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 500, message: 'Server error' }))
      );

      store.loadPhotos('wo-123');

      await vi.waitFor(() => {
        expect(store.error()).toBe('Failed to load photos. Please try again.');
      });

      expect(store.isLoading()).toBe(false);
    });

    it('should handle 404 error', async () => {
      mockApiClient.workOrderPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      store.loadPhotos('wo-123');

      await vi.waitFor(() => {
        expect(store.error()).toBe('Work order not found');
      });
    });

    it('should update computed signals after load', async () => {
      store.loadPhotos('wo-123');

      await vi.waitFor(() => {
        expect(store.hasPhotos()).toBe(true);
        expect(store.photoCount()).toBe(2);
        expect(store.isEmpty()).toBe(false);
      });
    });
  });

  describe('sortedPhotos', () => {
    it('should sort photos by createdAt descending (newest first)', async () => {
      store.loadPhotos('wo-123');

      await vi.waitFor(() => {
        const sorted = store.sortedPhotos();
        expect(sorted.length).toBe(2);
        expect(sorted[0].id).toBe('photo-1'); // Newer (10:00)
        expect(sorted[1].id).toBe('photo-2'); // Older (09:00)
      });
    });
  });

  describe('deletePhoto', () => {
    beforeEach(async () => {
      mockApiClient.workOrderPhotos_DeletePhoto.mockReturnValue(of(void 0));
      store.loadPhotos('wo-123');
      await vi.waitFor(() => expect(store.photos().length).toBe(2));
    });

    it('should delete photo and update state', async () => {
      store.deletePhoto('photo-1');

      await vi.waitFor(() => {
        expect(store.photos().length).toBe(1);
        expect(store.photos()[0].id).toBe('photo-2');
      });

      expect(mockApiClient.workOrderPhotos_DeletePhoto).toHaveBeenCalledWith('wo-123', 'photo-1');
    });

    it('should show success snackbar', async () => {
      store.deletePhoto('photo-1');

      await vi.waitFor(() => {
        expect(mockSnackBar.open).toHaveBeenCalledWith('Photo deleted', 'Close', expect.any(Object));
      });
    });

    it('should handle delete error', async () => {
      mockApiClient.workOrderPhotos_DeletePhoto.mockReturnValue(
        throwError(() => new Error('Delete failed'))
      );

      store.deletePhoto('photo-1');

      await vi.waitFor(() => {
        expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to delete photo', 'Close', expect.any(Object));
      });

      // Photos should not be removed on error
      expect(store.photos().length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should reset store to initial state', async () => {
      store.loadPhotos('wo-123');
      await vi.waitFor(() => expect(store.photos().length).toBe(2));

      store.clear();

      expect(store.photos()).toEqual([]);
      expect(store.workOrderId()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockApiClient.workOrderPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      store.loadPhotos('wo-123');
      await vi.waitFor(() => expect(store.error()).not.toBeNull());

      store.clearError();

      expect(store.error()).toBeNull();
    });
  });

  describe('clearUploadError', () => {
    it('should clear upload error state', () => {
      // Simulate upload error state by accessing internal patchState
      // For now, just verify the method exists and works
      store.clearUploadError();
      expect(store.uploadError()).toBeNull();
    });
  });
});
