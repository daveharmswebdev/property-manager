import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VendorPhotoStore } from './vendor-photo.store';
import { ApiClient, VendorPhotoDto, GetVendorPhotosResponse } from '../../../core/api/api.service';
import { PhotoUploadService } from '../../../shared/services/photo-upload.service';

describe('VendorPhotoStore', () => {
  let store: InstanceType<typeof VendorPhotoStore>;
  let apiClientMock: {
    vendorPhotos_GetPhotos: ReturnType<typeof vi.fn>;
    vendorPhotos_DeletePhoto: ReturnType<typeof vi.fn>;
    vendorPhotos_SetPrimaryPhoto: ReturnType<typeof vi.fn>;
    vendorPhotos_ReorderPhotos: ReturnType<typeof vi.fn>;
    vendorPhotos_GenerateUploadUrl: ReturnType<typeof vi.fn>;
    vendorPhotos_ConfirmUpload: ReturnType<typeof vi.fn>;
  };
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  let photoUploadServiceMock: { uploadPhoto: ReturnType<typeof vi.fn> };

  const mockPhotos: VendorPhotoDto[] = [
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

  const mockPhotosResponse: GetVendorPhotosResponse = {
    items: mockPhotos,
  };

  beforeEach(async () => {
    apiClientMock = {
      vendorPhotos_GetPhotos: vi.fn().mockReturnValue(of(mockPhotosResponse)),
      vendorPhotos_DeletePhoto: vi.fn().mockReturnValue(of(undefined)),
      vendorPhotos_SetPrimaryPhoto: vi.fn().mockReturnValue(of(undefined)),
      vendorPhotos_ReorderPhotos: vi.fn().mockReturnValue(of(undefined)),
      vendorPhotos_GenerateUploadUrl: vi.fn(),
      vendorPhotos_ConfirmUpload: vi.fn(),
    };

    snackBarMock = {
      open: vi.fn(),
    };

    photoUploadServiceMock = {
      uploadPhoto: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        VendorPhotoStore,
        { provide: ApiClient, useValue: apiClientMock },
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: PhotoUploadService, useValue: photoUploadServiceMock },
      ],
    }).compileComponents();

    store = TestBed.inject(VendorPhotoStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      expect(store.photos()).toEqual([]);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.vendorId()).toBeNull();
    });
  });

  describe('loadPhotos', () => {
    it('should load photos for a vendor', async () => {
      store.loadPhotos('vendor-1');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(apiClientMock.vendorPhotos_GetPhotos).toHaveBeenCalledWith('vendor-1');
      expect(store.photos()).toEqual(mockPhotos);
      expect(store.vendorId()).toBe('vendor-1');
      expect(store.isLoading()).toBe(false);
    });

    it('should handle error when loading photos', async () => {
      apiClientMock.vendorPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 500, message: 'Server error' }))
      );

      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(store.error()).toBe('Failed to load photos. Please try again.');
      expect(store.isLoading()).toBe(false);
    });

    it('should handle 404 error with specific message', async () => {
      apiClientMock.vendorPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 404 }))
      );

      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(store.error()).toBe('Vendor not found');
    });
  });

  describe('deletePhoto', () => {
    beforeEach(async () => {
      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('should delete a photo and remove from local state', async () => {
      expect(store.photos().length).toBe(3);

      store.deletePhoto('photo-2');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(apiClientMock.vendorPhotos_DeletePhoto).toHaveBeenCalledWith('vendor-1', 'photo-2');
      expect(store.photos().length).toBe(2);
      expect(store.photos().find((p) => p.id === 'photo-2')).toBeUndefined();
    });

    it('should show success snackbar after delete', async () => {
      store.deletePhoto('photo-2');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Photo deleted',
        'Close',
        expect.any(Object)
      );
    });

    it('should handle delete error', async () => {
      apiClientMock.vendorPhotos_DeletePhoto.mockReturnValue(
        throwError(() => new Error('Delete failed'))
      );

      store.deletePhoto('photo-2');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Failed to delete photo',
        'Close',
        expect.any(Object)
      );
    });
  });

  describe('setPrimaryPhoto', () => {
    beforeEach(async () => {
      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('should set a photo as primary and update local state', async () => {
      expect(store.photos().find((p) => p.id === 'photo-1')?.isPrimary).toBe(true);
      expect(store.photos().find((p) => p.id === 'photo-2')?.isPrimary).toBe(false);

      store.setPrimaryPhoto('photo-2');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(apiClientMock.vendorPhotos_SetPrimaryPhoto).toHaveBeenCalledWith(
        'vendor-1',
        'photo-2'
      );
      expect(store.photos().find((p) => p.id === 'photo-1')?.isPrimary).toBe(false);
      expect(store.photos().find((p) => p.id === 'photo-2')?.isPrimary).toBe(true);
    });

    it('should show success snackbar after setting primary', async () => {
      store.setPrimaryPhoto('photo-2');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Primary photo updated',
        'Close',
        expect.any(Object)
      );
    });
  });

  describe('reorderPhotos', () => {
    beforeEach(async () => {
      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('should reorder photos and update local state', async () => {
      const newOrder = ['photo-3', 'photo-1', 'photo-2'];

      store.reorderPhotos(newOrder);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(apiClientMock.vendorPhotos_ReorderPhotos).toHaveBeenCalledWith('vendor-1', {
        photoIds: newOrder,
      });

      const photos = store.photos();
      expect(photos.find((p) => p.id === 'photo-3')?.displayOrder).toBe(0);
      expect(photos.find((p) => p.id === 'photo-1')?.displayOrder).toBe(1);
      expect(photos.find((p) => p.id === 'photo-2')?.displayOrder).toBe(2);
    });

    it('should show success snackbar after reorder', async () => {
      store.reorderPhotos(['photo-2', 'photo-1', 'photo-3']);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Photos reordered',
        'Close',
        expect.any(Object)
      );
    });
  });

  describe('Computed Properties', () => {
    beforeEach(async () => {
      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));
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
      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('should reset store to initial state', () => {
      expect(store.photos().length).toBe(3);
      expect(store.vendorId()).toBe('vendor-1');

      store.clear();

      expect(store.photos()).toEqual([]);
      expect(store.vendorId()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      apiClientMock.vendorPhotos_GetPhotos.mockReturnValue(
        throwError(() => ({ status: 500 }))
      );

      store.loadPhotos('vendor-1');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(store.error()).toBeTruthy();

      store.clearError();

      expect(store.error()).toBeNull();
    });
  });
});
