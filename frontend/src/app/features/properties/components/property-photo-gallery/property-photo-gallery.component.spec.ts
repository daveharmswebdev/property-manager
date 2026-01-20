import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyPhotoGalleryComponent, PropertyPhoto } from './property-photo-gallery.component';
import { provideAnimations } from '@angular/platform-browser/animations';

describe('PropertyPhotoGalleryComponent', () => {
  let component: PropertyPhotoGalleryComponent;
  let fixture: ComponentFixture<PropertyPhotoGalleryComponent>;

  const mockPhotos: PropertyPhoto[] = [
    {
      id: 'photo-1',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      viewUrl: 'https://example.com/view1.jpg',
      isPrimary: true,
      displayOrder: 0,
      originalFileName: 'front-view.jpg',
      fileSizeBytes: 1024000,
      createdAt: new Date('2026-01-15'),
    },
    {
      id: 'photo-2',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      viewUrl: 'https://example.com/view2.jpg',
      isPrimary: false,
      displayOrder: 1,
      originalFileName: 'kitchen.jpg',
      fileSizeBytes: 2048000,
      createdAt: new Date('2026-01-16'),
    },
    {
      id: 'photo-3',
      thumbnailUrl: 'https://example.com/thumb3.jpg',
      viewUrl: 'https://example.com/view3.jpg',
      isPrimary: false,
      displayOrder: 2,
      originalFileName: 'bathroom.jpg',
      fileSizeBytes: 1536000,
      createdAt: new Date('2026-01-17'),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyPhotoGalleryComponent],
      providers: [provideAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyPhotoGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Empty State (AC-13.3b.3)', () => {
    it('should show empty state when no photos and not loading', () => {
      fixture.componentRef.setInput('photos', []);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.querySelector('h3').textContent).toContain('No photos yet');
    });

    it('should show "Add First Photo" button in empty state', () => {
      fixture.componentRef.setInput('photos', []);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const addButton = fixture.nativeElement.querySelector('.empty-state button');
      expect(addButton).toBeTruthy();
      expect(addButton.textContent).toContain('Add First Photo');
    });

    it('should emit addPhotoClick when "Add First Photo" is clicked', () => {
      fixture.componentRef.setInput('photos', []);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const addClickSpy = vi.fn();
      component.addPhotoClick.subscribe(addClickSpy);

      const addButton = fixture.nativeElement.querySelector('.empty-state button');
      addButton.click();

      expect(addClickSpy).toHaveBeenCalled();
    });
  });

  describe('Loading State (AC-13.3b.4)', () => {
    it('should show skeleton placeholders when loading', () => {
      fixture.componentRef.setInput('isLoading', true);
      fixture.detectChanges();

      const skeletons = fixture.nativeElement.querySelectorAll('.photo-skeleton');
      expect(skeletons.length).toBe(6);
    });

    it('should not show empty state when loading', () => {
      fixture.componentRef.setInput('isLoading', true);
      fixture.componentRef.setInput('photos', []);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });

    it('should show shimmer animation on skeletons', () => {
      fixture.componentRef.setInput('isLoading', true);
      fixture.detectChanges();

      const shimmer = fixture.nativeElement.querySelector('.skeleton-shimmer');
      expect(shimmer).toBeTruthy();
    });
  });

  describe('Photo Grid (AC-13.3b.2)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should display gallery grid with photos', () => {
      const grid = fixture.nativeElement.querySelector('.gallery-grid');
      expect(grid).toBeTruthy();

      const photoCards = fixture.nativeElement.querySelectorAll('.photo-card');
      expect(photoCards.length).toBe(3);
    });

    it('should show photo thumbnails', () => {
      const images = fixture.nativeElement.querySelectorAll('.photo-img');
      expect(images.length).toBe(3);
      expect(images[0].src).toBe('https://example.com/thumb1.jpg');
    });

    it('should show primary badge on primary photo', () => {
      const primaryBadge = fixture.nativeElement.querySelector('.photo-card.is-primary .primary-badge');
      expect(primaryBadge).toBeTruthy();
    });

    it('should not show primary badge on non-primary photos', () => {
      const nonPrimaryCards = fixture.nativeElement.querySelectorAll('.photo-card:not(.is-primary)');
      expect(nonPrimaryCards.length).toBe(2);

      nonPrimaryCards.forEach((card: Element) => {
        expect(card.querySelector('.primary-badge')).toBeFalsy();
      });
    });

    it('should emit photoClick when photo card is clicked', () => {
      const photoClickSpy = vi.fn();
      component.photoClick.subscribe(photoClickSpy);

      const firstCard = fixture.nativeElement.querySelector('.photo-card');
      firstCard.click();

      expect(photoClickSpy).toHaveBeenCalledWith(mockPhotos[0]);
    });

    it('should have proper accessibility attributes on photo cards', () => {
      const card = fixture.nativeElement.querySelector('.photo-card');
      expect(card.getAttribute('tabindex')).toBe('0');
      expect(card.getAttribute('role')).toBe('button');
      expect(card.getAttribute('aria-label')).toContain('front-view.jpg');
    });
  });

  describe('Add Photo Button', () => {
    it('should show "Add Photo" button in header when photos exist', () => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const addButton = fixture.nativeElement.querySelector('.add-photo-btn');
      expect(addButton).toBeTruthy();
      expect(addButton.textContent).toContain('Add Photo');
    });

    it('should not show "Add Photo" button in header when no photos', () => {
      fixture.componentRef.setInput('photos', []);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const addButton = fixture.nativeElement.querySelector('.add-photo-btn');
      expect(addButton).toBeFalsy();
    });

    it('should emit addPhotoClick when header "Add Photo" is clicked', () => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const addClickSpy = vi.fn();
      component.addPhotoClick.subscribe(addClickSpy);

      const addButton = fixture.nativeElement.querySelector('.add-photo-btn');
      addButton.click();

      expect(addClickSpy).toHaveBeenCalled();
    });
  });

  describe('Fade-in Animation (AC-13.3b.6)', () => {
    it('should add "loaded" class when image loads', () => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('.photo-img');
      expect(img.classList.contains('loaded')).toBe(false);

      // Simulate image load
      const loadEvent = new Event('load');
      img.dispatchEvent(loadEvent);

      expect(img.classList.contains('loaded')).toBe(true);
    });
  });

  describe('Responsive Grid (AC-13.3b.5)', () => {
    it('should have gallery-grid class for CSS grid layout', () => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();

      const grid = fixture.nativeElement.querySelector('.gallery-grid');
      expect(grid).toBeTruthy();
      // CSS media queries handle the actual column count
    });
  });
});
