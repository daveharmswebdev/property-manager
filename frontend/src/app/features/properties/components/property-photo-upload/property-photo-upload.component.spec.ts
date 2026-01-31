import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PropertyPhotoUploadComponent } from './property-photo-upload.component';
import { PhotoUploadService } from '../../../../shared/services/photo-upload.service';
import { PropertyPhotoStore } from '../../stores/property-photo.store';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('PropertyPhotoUploadComponent', () => {
  let component: PropertyPhotoUploadComponent;
  let fixture: ComponentFixture<PropertyPhotoUploadComponent>;
  let mockPhotoUploadService: Partial<PhotoUploadService>;
  let mockPhotoStore: {
    uploadPhoto: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockPhotoUploadService = {
      isValidFileType: vi.fn().mockReturnValue(true),
      isValidFileSize: vi.fn().mockReturnValue(true),
      getAcceptString: vi.fn().mockReturnValue('image/jpeg,image/png,image/gif,image/webp'),
      getMaxFileSizeBytes: vi.fn().mockReturnValue(10 * 1024 * 1024),
    };

    mockPhotoStore = {
      uploadPhoto: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [PropertyPhotoUploadComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PhotoUploadService, useValue: mockPhotoUploadService },
        { provide: PropertyPhotoStore, useValue: mockPhotoStore },
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

  it('should render the photo upload component', () => {
    const photoUpload = fixture.nativeElement.querySelector('app-photo-upload');
    expect(photoUpload).toBeTruthy();
  });

  it('should have uploadPhoto function that calls store', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const result = await component.uploadPhoto(file);

    expect(mockPhotoStore.uploadPhoto).toHaveBeenCalledWith(file);
    expect(result).toBe(true);
  });

  it('should emit uploadComplete output', () => {
    const uploadCompleteSpy = vi.fn();
    component.uploadComplete.subscribe(uploadCompleteSpy);
    component.uploadComplete.emit();

    expect(uploadCompleteSpy).toHaveBeenCalled();
  });

  it('should require propertyId input', () => {
    expect(component.propertyId()).toBe('property-123');
  });
});
