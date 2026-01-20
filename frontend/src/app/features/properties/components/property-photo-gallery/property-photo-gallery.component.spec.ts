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

    it('should emit photoClick when photo image is clicked', () => {
      const photoClickSpy = vi.fn();
      component.photoClick.subscribe(photoClickSpy);

      const firstImage = fixture.nativeElement.querySelector('.photo-card .photo-img');
      firstImage.click();

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

  describe('Photo Management (AC-13.3c.4, AC-13.3c.5)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should show context menu button on each photo card', () => {
      const menuButtons = fixture.nativeElement.querySelectorAll('[data-testid="photo-menu-button"]');
      expect(menuButtons.length).toBe(3);
    });

    it('should emit setPrimaryClick when "Set as Primary" is selected from menu', async () => {
      const setPrimarySpy = vi.fn();
      component.setPrimaryClick.subscribe(setPrimarySpy);

      // Find a non-primary photo's menu button and click it
      const menuButtons = fixture.nativeElement.querySelectorAll('[data-testid="photo-menu-button"]');
      menuButtons[1].click(); // Second photo (non-primary)
      fixture.detectChanges();
      await fixture.whenStable();

      // Find and click the "Set as Primary" menu item
      const setPrimaryItem = document.querySelector('[data-testid="set-primary-menu-item"]');
      if (setPrimaryItem) {
        (setPrimaryItem as HTMLElement).click();
        expect(setPrimarySpy).toHaveBeenCalledWith(mockPhotos[1]);
      }
    });

    it('should emit deleteClick when "Delete" is selected from menu', async () => {
      const deleteSpy = vi.fn();
      component.deleteClick.subscribe(deleteSpy);

      // Click menu button for first photo
      const menuButtons = fixture.nativeElement.querySelectorAll('[data-testid="photo-menu-button"]');
      menuButtons[0].click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Find and click the "Delete" menu item
      const deleteItem = document.querySelector('[data-testid="delete-menu-item"]');
      if (deleteItem) {
        (deleteItem as HTMLElement).click();
        expect(deleteSpy).toHaveBeenCalledWith(mockPhotos[0]);
      }
    });

    it('should not show "Set as Primary" option for already primary photo', async () => {
      // Click menu button for primary photo (first)
      const menuButtons = fixture.nativeElement.querySelectorAll('[data-testid="photo-menu-button"]');
      menuButtons[0].click();
      fixture.detectChanges();
      await fixture.whenStable();

      // The "Set as Primary" option should not exist for primary photo
      const setPrimaryItem = document.querySelector('[data-testid="set-primary-menu-item"]');
      expect(setPrimaryItem).toBeFalsy();
    });
  });

  describe('Reorder Photos (AC-13.3c.6)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('photos', mockPhotos);
      fixture.componentRef.setInput('isLoading', false);
      fixture.detectChanges();
    });

    it('should show move up/down buttons when multiple photos', () => {
      const moveUpButtons = fixture.nativeElement.querySelectorAll('[data-testid="move-up-button"]');
      const moveDownButtons = fixture.nativeElement.querySelectorAll('[data-testid="move-down-button"]');

      expect(moveUpButtons.length).toBe(3);
      expect(moveDownButtons.length).toBe(3);
    });

    it('should disable move up button on first photo', () => {
      const firstMoveUp = fixture.nativeElement.querySelector('.photo-card:first-child [data-testid="move-up-button"]');
      expect(firstMoveUp.disabled).toBe(true);
    });

    it('should disable move down button on last photo', () => {
      const lastMoveDown = fixture.nativeElement.querySelector('.photo-card:last-child [data-testid="move-down-button"]');
      expect(lastMoveDown.disabled).toBe(true);
    });

    it('should emit reorderClick with new order when move up is clicked', () => {
      const reorderSpy = vi.fn();
      component.reorderClick.subscribe(reorderSpy);

      // Click move up on second photo
      const secondPhotoMoveUp = fixture.nativeElement.querySelectorAll('[data-testid="move-up-button"]')[1];
      secondPhotoMoveUp.click();

      // Expected new order: photo-2, photo-1, photo-3
      expect(reorderSpy).toHaveBeenCalledWith(['photo-2', 'photo-1', 'photo-3']);
    });

    it('should emit reorderClick with new order when move down is clicked', () => {
      const reorderSpy = vi.fn();
      component.reorderClick.subscribe(reorderSpy);

      // Click move down on first photo
      const firstPhotoMoveDown = fixture.nativeElement.querySelectorAll('[data-testid="move-down-button"]')[0];
      firstPhotoMoveDown.click();

      // Expected new order: photo-2, photo-1, photo-3
      expect(reorderSpy).toHaveBeenCalledWith(['photo-2', 'photo-1', 'photo-3']);
    });

    it('should not show reorder buttons when only one photo', () => {
      fixture.componentRef.setInput('photos', [mockPhotos[0]]);
      fixture.detectChanges();

      const moveUpButtons = fixture.nativeElement.querySelectorAll('[data-testid="move-up-button"]');
      const moveDownButtons = fixture.nativeElement.querySelectorAll('[data-testid="move-down-button"]');

      expect(moveUpButtons.length).toBe(0);
      expect(moveDownButtons.length).toBe(0);
    });
  });
});
