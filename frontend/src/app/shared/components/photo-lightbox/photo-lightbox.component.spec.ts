import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PhotoLightboxComponent, PhotoLightboxData } from './photo-lightbox.component';

describe('PhotoLightboxComponent', () => {
  let component: PhotoLightboxComponent;
  let fixture: ComponentFixture<PhotoLightboxComponent>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  const mockPhotos = [
    {
      id: 'photo-1',
      viewUrl: 'https://example.com/photo1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      isPrimary: true,
      displayOrder: 0,
      contentType: 'image/jpeg',
      originalFileName: 'photo1.jpg',
    },
    {
      id: 'photo-2',
      viewUrl: 'https://example.com/photo2.jpg',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      isPrimary: false,
      displayOrder: 1,
      contentType: 'image/jpeg',
      originalFileName: 'photo2.jpg',
    },
    {
      id: 'photo-3',
      viewUrl: 'https://example.com/photo3.jpg',
      thumbnailUrl: 'https://example.com/thumb3.jpg',
      isPrimary: false,
      displayOrder: 2,
      contentType: 'image/png',
      originalFileName: 'photo3.png',
    },
  ];

  const defaultDialogData: PhotoLightboxData = {
    photos: mockPhotos,
    currentIndex: 0,
  };

  async function createComponent(dialogData: PhotoLightboxData = defaultDialogData): Promise<void> {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhotoLightboxComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoLightboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('Initialization', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should display the current photo', () => {
      const currentPhoto = component.currentPhoto();
      expect(currentPhoto).toBeTruthy();
      expect(currentPhoto?.id).toBe('photo-1');
    });
  });

  describe('Start at provided index', () => {
    beforeEach(async () => {
      await createComponent({ photos: mockPhotos, currentIndex: 1 });
    });

    it('should start at the provided currentIndex', () => {
      expect(component.currentPhoto()?.id).toBe('photo-2');
    });
  });

  describe('Clamp currentIndex', () => {
    beforeEach(async () => {
      await createComponent({ photos: mockPhotos, currentIndex: 10 });
    });

    it('should clamp currentIndex to valid range', () => {
      expect(component.currentIndex()).toBe(2); // Last valid index
    });
  });

  describe('Navigation (AC-13.3c.1)', () => {
    beforeEach(async () => {
      await createComponent({ photos: mockPhotos, currentIndex: 1 });
    });

    it('should navigate to next photo', () => {
      component.next();
      expect(component.currentPhoto()?.id).toBe('photo-3');
    });

    it('should navigate to previous photo', () => {
      component.previous();
      expect(component.currentPhoto()?.id).toBe('photo-1');
    });

    it('should wrap to first photo when navigating next from last', () => {
      component.next(); // Now at photo-3
      component.next(); // Should wrap to photo-1
      expect(component.currentPhoto()?.id).toBe('photo-1');
    });

    it('should wrap to last photo when navigating previous from first', () => {
      component.previous(); // Now at photo-1
      component.previous(); // Should wrap to photo-3
      expect(component.currentPhoto()?.id).toBe('photo-3');
    });

    it('should show photo counter (x of y)', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const counter = compiled.querySelector('[data-testid="photo-counter"]');
      expect(counter?.textContent).toContain('2 of 3');
    });

    it('should have prev button visible', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const prevBtn = compiled.querySelector('[data-testid="prev-button"]');
      expect(prevBtn).toBeTruthy();
    });

    it('should have next button visible', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const nextBtn = compiled.querySelector('[data-testid="next-button"]');
      expect(nextBtn).toBeTruthy();
    });
  });

  describe('Keyboard Navigation (AC-13.3c.2)', () => {
    beforeEach(async () => {
      await createComponent({ photos: mockPhotos, currentIndex: 1 });
    });

    it('should navigate to next photo on ArrowRight', () => {
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(component.currentPhoto()?.id).toBe('photo-3');
    });

    it('should navigate to previous photo on ArrowLeft', () => {
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(component.currentPhoto()?.id).toBe('photo-1');
    });

    it('should close dialog on Escape', () => {
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(dialogRefSpy.close).toHaveBeenCalled();
    });
  });

  describe('Close Functionality (AC-13.3c.3)', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should have a close button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const closeBtn = compiled.querySelector('[data-testid="close-button"]');
      expect(closeBtn).toBeTruthy();
    });

    it('should close dialog when close button is clicked', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const closeBtn = compiled.querySelector('[data-testid="close-button"]') as HTMLButtonElement;
      closeBtn.click();
      expect(dialogRefSpy.close).toHaveBeenCalled();
    });

    it('should close dialog on backdrop click', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const backdrop = compiled.querySelector('[data-testid="lightbox-backdrop"]') as HTMLElement;
      backdrop.click();
      expect(dialogRefSpy.close).toHaveBeenCalled();
    });

    it('should NOT close when clicking on content area', () => {
      dialogRefSpy.close.mockClear();
      const compiled = fixture.nativeElement as HTMLElement;
      const content = compiled.querySelector('[data-testid="lightbox-content"]') as HTMLElement;
      content.click();
      expect(dialogRefSpy.close).not.toHaveBeenCalled();
    });
  });

  describe('PhotoViewer Integration (AC-13.3c.1)', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should render photo-viewer component', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const viewer = compiled.querySelector('app-photo-viewer');
      expect(viewer).toBeTruthy();
    });

    it('should pass current photo viewUrl to photo-viewer', () => {
      expect(component.currentPhoto()?.viewUrl).toBe('https://example.com/photo1.jpg');
    });

    it('should pass current photo contentType to photo-viewer', () => {
      expect(component.currentPhoto()?.contentType).toBe('image/jpeg');
    });
  });

  describe('Single Photo Handling', () => {
    beforeEach(async () => {
      await createComponent({ photos: [mockPhotos[0]], currentIndex: 0 });
    });

    it('should hide navigation buttons when only one photo', () => {
      expect(component.showNavigation()).toBe(false);
    });

    it('should still show close button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const closeBtn = compiled.querySelector('[data-testid="close-button"]');
      expect(closeBtn).toBeTruthy();
    });
  });

  describe('Photo Filename Display', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should display the current photo filename', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const filename = compiled.querySelector('[data-testid="photo-filename"]');
      expect(filename?.textContent).toContain('photo1.jpg');
    });
  });
});
