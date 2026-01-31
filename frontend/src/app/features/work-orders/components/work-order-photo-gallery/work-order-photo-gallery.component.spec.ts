import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WorkOrderPhotoGalleryComponent } from './work-order-photo-gallery.component';
import { WorkOrderPhotoDto } from '../../../../core/api/api.service';

describe('WorkOrderPhotoGalleryComponent', () => {
  let component: WorkOrderPhotoGalleryComponent;
  let fixture: ComponentFixture<WorkOrderPhotoGalleryComponent>;

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkOrderPhotoGalleryComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkOrderPhotoGalleryComponent);
    component = fixture.componentInstance;
  });

  describe('Empty State', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', []);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should show empty state when no photos', () => {
      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No photos yet');
    });

    it('should show "Add First Photo" button in empty state', () => {
      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      const addButton = emptyState.querySelector('button');
      expect(addButton.textContent).toContain('Add First Photo');
    });

    it('should emit addPhotoClick when "Add First Photo" clicked', () => {
      const addPhotoSpy = vi.fn();
      component.addPhotoClick.subscribe(addPhotoSpy);

      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      const addButton = emptyState.querySelector('button');
      addButton.click();

      expect(addPhotoSpy).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', []);
      fixture.componentRef.setInput('isLoading', true);
      fixture.detectChanges();
    });

    it('should show skeleton loading grid', () => {
      const loadingGrid = fixture.nativeElement.querySelector('[data-testid="loading-grid"]');
      expect(loadingGrid).toBeTruthy();
    });

    it('should show 6 skeleton items', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('.photo-skeleton');
      expect(skeletons.length).toBe(6);
    });

    it('should not show empty state while loading', () => {
      const emptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeFalsy();
    });
  });

  describe('Photo Grid Display', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should display photo grid', () => {
      const photoGrid = fixture.nativeElement.querySelector('[data-testid="photo-grid"]');
      expect(photoGrid).toBeTruthy();
    });

    it('should display all photos', () => {
      const photoCards = fixture.nativeElement.querySelectorAll('.photo-card');
      expect(photoCards.length).toBe(2);
    });

    it('should display photo count in header', () => {
      const photoCount = fixture.nativeElement.querySelector('.photo-count');
      expect(photoCount.textContent).toContain('(2)');
    });

    it('should show "Add Photo" button in header', () => {
      const addButton = fixture.nativeElement.querySelector('.add-photo-btn');
      expect(addButton).toBeTruthy();
      expect(addButton.textContent).toContain('Add Photo');
    });

    it('should use thumbnail URL for images', () => {
      const img = fixture.nativeElement.querySelector('.photo-img');
      expect(img.src).toContain('thumb1.jpg');
    });

    it('should fall back to photoUrl if no thumbnail', () => {
      const photosWithoutThumbnail: WorkOrderPhotoDto[] = [{
        ...mockPhotos[0],
        thumbnailUrl: undefined,
      }];
      fixture.componentRef.setInput('photos', photosWithoutThumbnail);
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('.photo-img');
      expect(img.src).toContain('photo1.jpg');
    });
  });

  describe('Photo Click (Lightbox)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should emit photoClick when photo image is clicked', () => {
      const photoClickSpy = vi.fn();
      component.photoClick.subscribe(photoClickSpy);

      const img = fixture.nativeElement.querySelector('.photo-img');
      img.click();

      expect(photoClickSpy).toHaveBeenCalledWith(mockPhotos[0]);
    });

    it('should emit photoClick on enter key', () => {
      const photoClickSpy = vi.fn();
      component.photoClick.subscribe(photoClickSpy);

      const img = fixture.nativeElement.querySelector('.photo-img');
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      img.dispatchEvent(enterEvent);

      expect(photoClickSpy).toHaveBeenCalledWith(mockPhotos[0]);
    });
  });

  describe('Delete Photo', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should have delete button for each photo', () => {
      const deleteButtons = fixture.nativeElement.querySelectorAll('.delete-btn');
      expect(deleteButtons.length).toBe(2);
    });

    it('should emit deleteClick when delete button clicked', () => {
      const deleteClickSpy = vi.fn();
      component.deleteClick.subscribe(deleteClickSpy);

      const deleteBtn = fixture.nativeElement.querySelector('[data-testid="delete-btn-photo-1"]');
      deleteBtn.click();

      expect(deleteClickSpy).toHaveBeenCalledWith(mockPhotos[0]);
    });

    it('should not emit photoClick when delete is clicked', () => {
      const photoClickSpy = vi.fn();
      component.photoClick.subscribe(photoClickSpy);

      const deleteBtn = fixture.nativeElement.querySelector('[data-testid="delete-btn-photo-1"]');
      deleteBtn.click();

      expect(photoClickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Add Photo Click', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should emit addPhotoClick when header button clicked', () => {
      const addPhotoSpy = vi.fn();
      component.addPhotoClick.subscribe(addPhotoSpy);

      const addButton = fixture.nativeElement.querySelector('.add-photo-btn');
      addButton.click();

      expect(addPhotoSpy).toHaveBeenCalled();
    });
  });

  describe('Image Loading Animation', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should add loaded class on image load', () => {
      const img = fixture.nativeElement.querySelector('.photo-img');

      // Initially no loaded class
      expect(img.classList.contains('loaded')).toBe(false);

      // Simulate load event
      img.dispatchEvent(new Event('load'));

      expect(img.classList.contains('loaded')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should have role="button" on photo cards', () => {
      const photoCard = fixture.nativeElement.querySelector('.photo-card');
      expect(photoCard.getAttribute('role')).toBe('button');
    });

    it('should have tabindex for keyboard navigation', () => {
      const photoCard = fixture.nativeElement.querySelector('.photo-card');
      expect(photoCard.getAttribute('tabindex')).toBe('0');
    });

    it('should have aria-label on delete button', () => {
      const deleteBtn = fixture.nativeElement.querySelector('.delete-btn');
      expect(deleteBtn.getAttribute('aria-label')).toBe('Delete photo');
    });

    it('should have aria-label with filename on photo card', () => {
      const photoCard = fixture.nativeElement.querySelector('[data-testid="photo-card-photo-1"]');
      expect(photoCard.getAttribute('aria-label')).toContain('photo1.jpg');
    });
  });
});
