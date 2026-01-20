import { TestBed } from '@angular/core/testing';
import { PhotoUploadService, PhotoUploadOptions } from './photo-upload.service';
import {
  ApiClient,
  GeneratePhotoUploadUrlResponse,
  ConfirmPhotoUploadResponse,
  PhotoEntityType,
} from '../../core/api/api.service';
import { of, throwError } from 'rxjs';

describe('PhotoUploadService', () => {
  let service: PhotoUploadService;
  let apiClientSpy: {
    photos_GenerateUploadUrl: ReturnType<typeof vi.fn>;
    photos_ConfirmUpload: ReturnType<typeof vi.fn>;
  };

  const mockUploadUrlResponse: GeneratePhotoUploadUrlResponse = {
    uploadUrl: 'https://s3.amazonaws.com/bucket/key?presigned',
    storageKey: 'account123/Properties/2026/uuid.jpg',
    thumbnailStorageKey: 'account123/Properties/2026/uuid_thumb.jpg',
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockConfirmResponse: ConfirmPhotoUploadResponse = {
    storageKey: 'account123/Properties/2026/uuid.jpg',
    thumbnailStorageKey: 'account123/Properties/2026/uuid_thumb.jpg',
    contentType: 'image/jpeg',
    fileSizeBytes: 1024,
  };

  beforeEach(() => {
    apiClientSpy = {
      photos_GenerateUploadUrl: vi.fn(),
      photos_ConfirmUpload: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PhotoUploadService, { provide: ApiClient, useValue: apiClientSpy }],
    });

    service = TestBed.inject(PhotoUploadService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadPhoto', () => {
    const defaultOptions: PhotoUploadOptions = {
      entityType: PhotoEntityType.Properties,
      entityId: 'property-uuid-123',
    };

    it('should request presigned URL, upload to S3, and confirm upload', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'photo.jpg', { type: 'image/jpeg' });
      apiClientSpy.photos_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      apiClientSpy.photos_ConfirmUpload.mockReturnValue(of(mockConfirmResponse));
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

      // Act
      const result = await service.uploadPhoto(mockFile, defaultOptions);

      // Assert
      expect(apiClientSpy.photos_GenerateUploadUrl).toHaveBeenCalledWith({
        entityType: PhotoEntityType.Properties,
        entityId: 'property-uuid-123',
        contentType: 'image/jpeg',
        fileSizeBytes: mockFile.size,
        originalFileName: 'photo.jpg',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        mockUploadUrlResponse.uploadUrl,
        expect.objectContaining({
          method: 'PUT',
          body: mockFile,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      expect(apiClientSpy.photos_ConfirmUpload).toHaveBeenCalledWith({
        storageKey: mockUploadUrlResponse.storageKey,
        thumbnailStorageKey: mockUploadUrlResponse.thumbnailStorageKey,
        contentType: 'image/jpeg',
        fileSizeBytes: mockFile.size,
      });

      expect(result).toEqual({
        storageKey: mockConfirmResponse.storageKey,
        thumbnailStorageKey: mockConfirmResponse.thumbnailStorageKey,
        contentType: mockConfirmResponse.contentType,
        fileSizeBytes: mockConfirmResponse.fileSizeBytes,
      });
    });

    it('should handle different entity types', async () => {
      // Arrange
      const mockFile = new File(['test'], 'vendor-logo.png', { type: 'image/png' });
      const options: PhotoUploadOptions = {
        entityType: PhotoEntityType.Vendors,
        entityId: 'vendor-uuid-456',
      };

      apiClientSpy.photos_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      apiClientSpy.photos_ConfirmUpload.mockReturnValue(of(mockConfirmResponse));
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

      // Act
      await service.uploadPhoto(mockFile, options);

      // Assert
      expect(apiClientSpy.photos_GenerateUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: PhotoEntityType.Vendors,
          entityId: 'vendor-uuid-456',
        })
      );
    });

    // Note: Progress tracking uses XMLHttpRequest which is harder to mock in Vitest
    // The onProgress callback is tested implicitly through integration tests

    it('should throw error for invalid file type', async () => {
      // Arrange
      const mockFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });

      // Act & Assert
      await expect(service.uploadPhoto(mockFile, defaultOptions)).rejects.toThrow(
        /Invalid file type/
      );
    });

    it('should throw error for oversized file', async () => {
      // Arrange - Create a mock file that reports large size
      const mockFile = new File(['test'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 11 * 1024 * 1024 });

      // Act & Assert
      await expect(service.uploadPhoto(mockFile, defaultOptions)).rejects.toThrow(
        /File too large/
      );
    });

    it('should throw error when presigned URL generation fails', async () => {
      // Arrange
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      apiClientSpy.photos_GenerateUploadUrl.mockReturnValue(
        throwError(() => new Error('Failed to generate upload URL'))
      );

      // Act & Assert
      await expect(service.uploadPhoto(mockFile, defaultOptions)).rejects.toThrow(
        'Failed to generate upload URL'
      );
    });

    it('should throw error when S3 upload fails', async () => {
      // Arrange
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      apiClientSpy.photos_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500, statusText: 'Error' } as Response);

      // Act & Assert
      await expect(service.uploadPhoto(mockFile, defaultOptions)).rejects.toThrow(/S3 upload failed/);
    });

    it('should throw error when confirm upload fails', async () => {
      // Arrange
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      apiClientSpy.photos_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
      apiClientSpy.photos_ConfirmUpload.mockReturnValue(
        throwError(() => new Error('Failed to confirm upload'))
      );

      // Act & Assert
      await expect(service.uploadPhoto(mockFile, defaultOptions)).rejects.toThrow(
        'Failed to confirm upload'
      );
    });

    it('should handle null thumbnail storage key in response', async () => {
      // Arrange
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      const confirmResponseNoThumbnail: ConfirmPhotoUploadResponse = {
        ...mockConfirmResponse,
        thumbnailStorageKey: undefined,
      };

      apiClientSpy.photos_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      apiClientSpy.photos_ConfirmUpload.mockReturnValue(of(confirmResponseNoThumbnail));
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

      // Act
      const result = await service.uploadPhoto(mockFile, defaultOptions);

      // Assert
      expect(result.thumbnailStorageKey).toBeNull();
    });
  });

  describe('isValidFileType', () => {
    it('should return true for jpeg images', () => {
      expect(service.isValidFileType('image/jpeg')).toBe(true);
    });

    it('should return true for png images', () => {
      expect(service.isValidFileType('image/png')).toBe(true);
    });

    it('should return true for gif images', () => {
      expect(service.isValidFileType('image/gif')).toBe(true);
    });

    it('should return true for webp images', () => {
      expect(service.isValidFileType('image/webp')).toBe(true);
    });

    it('should return true for bmp images', () => {
      expect(service.isValidFileType('image/bmp')).toBe(true);
    });

    it('should return true for tiff images', () => {
      expect(service.isValidFileType('image/tiff')).toBe(true);
    });

    it('should return false for PDF (photos only, not receipts)', () => {
      expect(service.isValidFileType('application/pdf')).toBe(false);
    });

    it('should return false for unsupported types', () => {
      expect(service.isValidFileType('text/plain')).toBe(false);
      expect(service.isValidFileType('application/json')).toBe(false);
      expect(service.isValidFileType('video/mp4')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(service.isValidFileType('IMAGE/JPEG')).toBe(true);
      expect(service.isValidFileType('Image/Png')).toBe(true);
    });
  });

  describe('isValidFileSize', () => {
    it('should return true for files under 10MB', () => {
      expect(service.isValidFileSize(1024)).toBe(true); // 1KB
      expect(service.isValidFileSize(5 * 1024 * 1024)).toBe(true); // 5MB
      expect(service.isValidFileSize(10 * 1024 * 1024)).toBe(true); // exactly 10MB
    });

    it('should return false for files over 10MB', () => {
      expect(service.isValidFileSize(10 * 1024 * 1024 + 1)).toBe(false); // 10MB + 1 byte
      expect(service.isValidFileSize(20 * 1024 * 1024)).toBe(false); // 20MB
    });

    it('should return false for zero or negative size', () => {
      expect(service.isValidFileSize(0)).toBe(false);
      expect(service.isValidFileSize(-1)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should return max file size in bytes', () => {
      expect(service.getMaxFileSizeBytes()).toBe(10 * 1024 * 1024);
    });

    it('should return allowed content types', () => {
      const types = service.getAllowedContentTypes();
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
      expect(types).toContain('image/gif');
      expect(types).toContain('image/webp');
      expect(types).not.toContain('application/pdf');
    });

    it('should return accept string for file inputs', () => {
      const acceptString = service.getAcceptString();
      expect(acceptString).toContain('image/jpeg');
      expect(acceptString).toContain('image/png');
      expect(acceptString).toContain(',');
    });
  });
});
