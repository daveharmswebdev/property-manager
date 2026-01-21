import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PropertyPhotoStore } from './property-photo.store';
import { ApiClient, PropertyPhotoDto, GetPropertyPhotosResponse } from '../../../core/api/api.service';
import { PhotoUploadService } from '../../../shared/services/photo-upload.service';

describe('PropertyPhotoStore', () => {
  let store: InstanceType<typeof PropertyPhotoStore>;
  let apiClientMock: {
    propertyPhotos_GetPhotos: ReturnType<typeof vi.fn>;
    propertyPhotos_DeletePhoto: ReturnType<typeof vi.fn>;
    propertyPhotos_SetPrimaryPhoto: ReturnType<typeof vi.fn>;
    propertyPhotos_ReorderPhotos: ReturnType<typeof vi.fn>;
    propertyPhotos_GenerateUploadUrl: ReturnType<typeof vi.fn>;
    propertyPhotos_ConfirmUpload: ReturnType<typeof vi.fn>;
  };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  let photoUploadServiceMock: { uploadPhoto: ReturnType<typeof vi.fn> };

  const mockPhotos: PropertyPhotoDto[] = [
    {
      id: 'photo-1',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      viewUrl: 'https://example.com/view1.jpg',
      isPrimary: true,
      displayOrder: 0,
      originalFileName: 'photo1.jpg',
      fileSizeBytes: 1024,
      createdAt: new Date(),
    },
    {
      id: 'photo-2',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      viewUrl: 'https://example.com/view2.jpg',
      isPrimary: false,
      displayOrder: 1,
      originalFileName: 'photo2.jpg',
      fileSizeBytes: 2048,
      createdAt: new Date(),
    },
    {
      id: 'photo-3',
      thumbnailUrl: 'https://example.com/thumb3.jpg',
      viewUrl: 'https://example.com/view3.jpg',
      isPrimary: false,
      displayOrder: 2,
      originalFileName: 'photo3.jpg',
      fileSizeBytes: 3072,
      createdAt: new Date(),
    },
  ];

  const mockPhotosResponse: GetPropertyPhotosResponse = {
    items: mockPhotos,
  };

  beforeEach(async () => {
    apiClientMock = {
      propertyPhotos_GetPhotos: vi.fn().mockReturnValue(of(mockPhotosResponse)),
      propertyPhotos_DeletePhoto: vi.fn().mockReturnValue(of(undefined)),
      propertyPhotos_SetPrimaryPhoto: vi.fn().mockReturnValue(of(undefined)),
      propertyPhotos_ReorderPhotos: vi.fn().mockReturnValue(of(undefined)),
      propertyPhotos_GenerateUploadUrl: vi.fn(),
      propertyPhotos_ConfirmUpload: vi.fn(),
    };

    snackBarMock = {
      open: vi.fn(),
    };

    photoUploadServiceMock = {
      uploadPhoto: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        PropertyPhotoStore,
        { provide: ApiClient, useValue: apiClientMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: PhotoUploadService, useValue: photoUploadServiceMock },
      ],
    }).compileComponents();

    store = TestBed.inject(PropertyPhotoStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      expect(store.photos()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.propertyId()).toBeNull();
    });
  });

  describe('loadPhotos', () => {
    it('should load photos for a property', async () => {
      store.loadPhotos('prop-1');

      // Wait for observable to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(apiClientMock.propertyPhotos_GetPhotos).toHaveBeenCalledWith('prop-1');
      expect(store.photos()).toEqual(mockPhotos);
      expect(store.propertyId()).toBe('prop-1');
      expect(store.isLoading()).toBe(false);
    });

    it('should handle error when loading photos', async () => {
      apiClientMock.propertyPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 500, message: 'Server error' }))
      );

      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBe('Failed to load photos. Please try again.');
      expect(store.isLoading()).toBe(false);
    });

    it('should handle 404 error with specific message', async () => {
      apiClientMock.propertyPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBe('Property not found');
    });
  });

  describe('deletePhoto', () => {
    beforeEach(async () => {
      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should delete a photo and remove from local state', async () => {
      expect(store.photos().length).toBe(3);

      store.deletePhoto('photo-2');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(apiClientMock.propertyPhotos_DeletePhoto).toHaveBeenCalledWith('prop-1', 'photo-2');
      expect(store.photos().length).toBe(2);
      expect(store.photos().find(p => p.id === 'photo-2')).toBeUndefined();
    });

    it('should show success snackbar after delete', async () => {
      store.deletePhoto('photo-2');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith('Photo deleted', 'Close', expect.any(Object));
    });

    it('should handle delete error', async () => {
      apiClientMock.propertyPhotos_DeletePhoto.mockReturnValue(
        throwError(() => new Error('Delete failed'))
      );

      const originalLength = store.photos().length;
      store.deletePhoto('photo-2');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith('Failed to delete photo', 'Close', expect.any(Object));
      // Photos should remain unchanged on error (optimistic update not implemented for error)
    });
  });

  describe('setPrimaryPhoto', () => {
    beforeEach(async () => {
      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should set a photo as primary and update local state', async () => {
      expect(store.photos().find(p => p.id === 'photo-1')?.isPrimary).toBe(true);
      expect(store.photos().find(p => p.id === 'photo-2')?.isPrimary).toBe(false);

      store.setPrimaryPhoto('photo-2');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(apiClientMock.propertyPhotos_SetPrimaryPhoto).toHaveBeenCalledWith('prop-1', 'photo-2');
      expect(store.photos().find(p => p.id === 'photo-1')?.isPrimary).toBe(false);
      expect(store.photos().find(p => p.id === 'photo-2')?.isPrimary).toBe(true);
    });

    it('should show success snackbar after setting primary', async () => {
      store.setPrimaryPhoto('photo-2');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith('Primary photo updated', 'Close', expect.any(Object));
    });

    it('should handle set primary error', async () => {
      apiClientMock.propertyPhotos_SetPrimaryPhoto.mockReturnValue(
        throwError(() => new Error('Set primary failed'))
      );

      store.setPrimaryPhoto('photo-2');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith('Failed to set primary photo', 'Close', expect.any(Object));
    });
  });

  describe('reorderPhotos', () => {
    beforeEach(async () => {
      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should reorder photos and update local state', async () => {
      const newOrder = ['photo-3', 'photo-1', 'photo-2'];

      store.reorderPhotos(newOrder);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(apiClientMock.propertyPhotos_ReorderPhotos).toHaveBeenCalledWith('prop-1', { photoIds: newOrder });

      // Check that display order is updated
      const photos = store.photos();
      expect(photos.find(p => p.id === 'photo-3')?.displayOrder).toBe(0);
      expect(photos.find(p => p.id === 'photo-1')?.displayOrder).toBe(1);
      expect(photos.find(p => p.id === 'photo-2')?.displayOrder).toBe(2);
    });

    it('should show success snackbar after reorder', async () => {
      store.reorderPhotos(['photo-2', 'photo-1', 'photo-3']);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith('Photos reordered', 'Close', expect.any(Object));
    });

    it('should handle reorder error', async () => {
      apiClientMock.propertyPhotos_ReorderPhotos.mockReturnValue(
        throwError(() => new Error('Reorder failed'))
      );

      store.reorderPhotos(['photo-2', 'photo-1', 'photo-3']);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith('Failed to reorder photos', 'Close', expect.any(Object));
    });
  });

  describe('Computed Properties', () => {
    beforeEach(async () => {
      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should compute photoCount correctly', () => {
      expect(store.photoCount()).toBe(3);
    });

    it('should compute hasPhotos correctly', () => {
      expect(store.hasPhotos()).toBe(true);
    });

    it('should compute isEmpty correctly', () => {
      expect(store.isEmpty()).toBe(false);
    });

    it('should compute primaryPhoto correctly', () => {
      const primary = store.primaryPhoto();
      expect(primary?.id).toBe('photo-1');
      expect(primary?.isPrimary).toBe(true);
    });

    it('should compute sortedPhotos by displayOrder', () => {
      const sorted = store.sortedPhotos();
      expect(sorted[0].displayOrder).toBe(0);
      expect(sorted[1].displayOrder).toBe(1);
      expect(sorted[2].displayOrder).toBe(2);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should reset store to initial state', () => {
      expect(store.photos().length).toBe(3);
      expect(store.propertyId()).toBe('prop-1');

      store.clear();

      expect(store.photos()).toEqual([]);
      expect(store.propertyId()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      apiClientMock.propertyPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      store.loadPhotos('prop-1');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(store.error()).toBeTruthy();

      store.clearError();

      expect(store.error()).toBeNull();
    });
  });
});
