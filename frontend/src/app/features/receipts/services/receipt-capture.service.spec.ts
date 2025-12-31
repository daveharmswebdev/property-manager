import { TestBed } from '@angular/core/testing';
import { ReceiptCaptureService } from './receipt-capture.service';
import { ApiClient, UploadUrlResponse, CreateReceiptResponse } from '../../../core/api/api.service';
import { of, throwError } from 'rxjs';

describe('ReceiptCaptureService', () => {
  let service: ReceiptCaptureService;
  let apiClientSpy: {
    receipts_GenerateUploadUrl: ReturnType<typeof vi.fn>;
    receipts_CreateReceipt: ReturnType<typeof vi.fn>;
  };

  const mockUploadUrlResponse: UploadUrlResponse = {
    uploadUrl: 'https://s3.amazonaws.com/bucket/key?presigned',
    storageKey: 'account123/2024/uuid.jpg',
    expiresAt: new Date(Date.now() + 3600000),
    httpMethod: 'PUT',
  };

  const mockCreateReceiptResponse: CreateReceiptResponse = {
    id: 'receipt-uuid-123',
  };

  beforeEach(() => {
    apiClientSpy = {
      receipts_GenerateUploadUrl: vi.fn(),
      receipts_CreateReceipt: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ReceiptCaptureService,
        { provide: ApiClient, useValue: apiClientSpy },
      ],
    });

    service = TestBed.inject(ReceiptCaptureService);
  });

  describe('uploadReceipt', () => {
    it('should request presigned URL, upload to S3, and create receipt', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'receipt.jpg', { type: 'image/jpeg' });
      const propertyId = 'property-uuid-456';

      apiClientSpy.receipts_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      apiClientSpy.receipts_CreateReceipt.mockReturnValue(of(mockCreateReceiptResponse));

      // Mock fetch for S3 upload
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      // Act
      const receiptId = await service.uploadReceipt(mockFile, propertyId);

      // Assert
      expect(apiClientSpy.receipts_GenerateUploadUrl).toHaveBeenCalledWith({
        contentType: 'image/jpeg',
        fileSizeBytes: mockFile.size,
        propertyId,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        mockUploadUrlResponse.uploadUrl,
        expect.objectContaining({
          method: 'PUT',
          body: mockFile,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      expect(apiClientSpy.receipts_CreateReceipt).toHaveBeenCalledWith({
        storageKey: mockUploadUrlResponse.storageKey,
        originalFileName: 'receipt.jpg',
        contentType: 'image/jpeg',
        fileSizeBytes: mockFile.size,
        propertyId,
      });

      expect(receiptId).toBe('receipt-uuid-123');
    });

    it('should upload receipt without propertyId when not provided', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'receipt.png', { type: 'image/png' });

      apiClientSpy.receipts_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      apiClientSpy.receipts_CreateReceipt.mockReturnValue(of(mockCreateReceiptResponse));
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      // Act
      const receiptId = await service.uploadReceipt(mockFile);

      // Assert
      expect(apiClientSpy.receipts_GenerateUploadUrl).toHaveBeenCalledWith({
        contentType: 'image/png',
        fileSizeBytes: mockFile.size,
        propertyId: undefined,
      });

      expect(apiClientSpy.receipts_CreateReceipt).toHaveBeenCalledWith({
        storageKey: mockUploadUrlResponse.storageKey,
        originalFileName: 'receipt.png',
        contentType: 'image/png',
        fileSizeBytes: mockFile.size,
        propertyId: undefined,
      });

      expect(receiptId).toBe('receipt-uuid-123');
    });

    it('should throw error when presigned URL generation fails', async () => {
      // Arrange
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      apiClientSpy.receipts_GenerateUploadUrl.mockReturnValue(
        throwError(() => new Error('Failed to generate upload URL'))
      );

      // Act & Assert
      await expect(service.uploadReceipt(mockFile)).rejects.toThrow('Failed to generate upload URL');
    });

    it('should throw error when S3 upload fails', async () => {
      // Arrange
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      apiClientSpy.receipts_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      // Act & Assert
      await expect(service.uploadReceipt(mockFile)).rejects.toThrow('S3 upload failed');
    });

    it('should throw error when receipt creation fails', async () => {
      // Arrange
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      apiClientSpy.receipts_GenerateUploadUrl.mockReturnValue(of(mockUploadUrlResponse));
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      apiClientSpy.receipts_CreateReceipt.mockReturnValue(
        throwError(() => new Error('Failed to create receipt'))
      );

      // Act & Assert
      await expect(service.uploadReceipt(mockFile)).rejects.toThrow('Failed to create receipt');
    });
  });

  describe('isValidFileType', () => {
    it('should return true for jpeg images', () => {
      expect(service.isValidFileType('image/jpeg')).toBe(true);
    });

    it('should return true for png images', () => {
      expect(service.isValidFileType('image/png')).toBe(true);
    });

    it('should return true for pdf files', () => {
      expect(service.isValidFileType('application/pdf')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(service.isValidFileType('image/gif')).toBe(false);
      expect(service.isValidFileType('text/plain')).toBe(false);
      expect(service.isValidFileType('application/json')).toBe(false);
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
  });
});
