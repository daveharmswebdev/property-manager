import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PhotoViewerComponent } from './photo-viewer.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('PhotoViewerComponent', () => {
  let component: PhotoViewerComponent;
  let fixture: ComponentFixture<PhotoViewerComponent>;

  const mockImageUrl = 'https://s3.amazonaws.com/test-image.jpg';
  const mockThumbnailUrl = 'https://s3.amazonaws.com/test-image-thumb.jpg';
  const mockPdfUrl = 'https://s3.amazonaws.com/test-doc.pdf';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoViewerComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  describe('with image content', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(PhotoViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockImageUrl);
      fixture.componentRef.setInput('contentType', 'image/jpeg');
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should display viewer controls', () => {
      const controls = fixture.debugElement.query(By.css('[data-testid="viewer-controls"]'));
      expect(controls).toBeTruthy();
    });

    it('should display zoom buttons', () => {
      const zoomIn = fixture.debugElement.query(By.css('[data-testid="zoom-in-btn"]'));
      const zoomOut = fixture.debugElement.query(By.css('[data-testid="zoom-out-btn"]'));
      expect(zoomIn).toBeTruthy();
      expect(zoomOut).toBeTruthy();
    });

    it('should display rotate buttons', () => {
      const rotateLeft = fixture.debugElement.query(By.css('[data-testid="rotate-left-btn"]'));
      const rotateRight = fixture.debugElement.query(By.css('[data-testid="rotate-right-btn"]'));
      expect(rotateLeft).toBeTruthy();
      expect(rotateRight).toBeTruthy();
    });

    it('should display reset button', () => {
      const reset = fixture.debugElement.query(By.css('[data-testid="reset-btn"]'));
      expect(reset).toBeTruthy();
    });

    it('should display zoom level at 100%', () => {
      const zoomLevel = fixture.debugElement.query(By.css('[data-testid="zoom-level"]'));
      expect(zoomLevel.nativeElement.textContent).toContain('100%');
    });

    it('should display image viewport', () => {
      const viewport = fixture.debugElement.query(By.css('[data-testid="image-viewport"]'));
      expect(viewport).toBeTruthy();
    });

    it('should not display PDF placeholder for image', () => {
      const pdfPlaceholder = fixture.debugElement.query(By.css('[data-testid="pdf-placeholder"]'));
      expect(pdfPlaceholder).toBeNull();
    });

    it('should increase zoom on zoom in click', () => {
      const zoomIn = fixture.debugElement.query(By.css('[data-testid="zoom-in-btn"]'));
      zoomIn.nativeElement.click();
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(By.css('[data-testid="zoom-level"]'));
      expect(zoomLevel.nativeElement.textContent).toContain('125%');
    });

    it('should decrease zoom on zoom out click', () => {
      const zoomOut = fixture.debugElement.query(By.css('[data-testid="zoom-out-btn"]'));
      zoomOut.nativeElement.click();
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(By.css('[data-testid="zoom-level"]'));
      expect(zoomLevel.nativeElement.textContent).toContain('75%');
    });

    it('should not exceed max zoom of 200%', () => {
      const zoomIn = fixture.debugElement.query(By.css('[data-testid="zoom-in-btn"]'));
      // Click 5 times (100 -> 125 -> 150 -> 175 -> 200 -> 200)
      for (let i = 0; i < 5; i++) {
        zoomIn.nativeElement.click();
      }
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(By.css('[data-testid="zoom-level"]'));
      expect(zoomLevel.nativeElement.textContent).toContain('200%');
    });

    it('should not go below min zoom of 50%', () => {
      const zoomOut = fixture.debugElement.query(By.css('[data-testid="zoom-out-btn"]'));
      // Click 3 times (100 -> 75 -> 50 -> 50)
      for (let i = 0; i < 3; i++) {
        zoomOut.nativeElement.click();
      }
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(By.css('[data-testid="zoom-level"]'));
      expect(zoomLevel.nativeElement.textContent).toContain('50%');
    });

    it('should reset view on reset button click', () => {
      // First zoom in
      const zoomIn = fixture.debugElement.query(By.css('[data-testid="zoom-in-btn"]'));
      zoomIn.nativeElement.click();
      fixture.detectChanges();

      // Then reset
      const reset = fixture.debugElement.query(By.css('[data-testid="reset-btn"]'));
      reset.nativeElement.click();
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(By.css('[data-testid="zoom-level"]'));
      expect(zoomLevel.nativeElement.textContent).toContain('100%');
    });

    it('should display the photo image element', () => {
      const image = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));
      expect(image).toBeTruthy();
      expect(image.nativeElement.src).toBe(mockImageUrl);
    });
  });

  describe('with thumbnail support', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(PhotoViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockImageUrl);
      fixture.componentRef.setInput('thumbnailUrl', mockThumbnailUrl);
      fixture.componentRef.setInput('contentType', 'image/jpeg');
      fixture.detectChanges();
    });

    it('should display thumbnail image when provided', () => {
      const thumbnail = fixture.debugElement.query(By.css('[data-testid="photo-thumbnail"]'));
      expect(thumbnail).toBeTruthy();
      expect(thumbnail.nativeElement.src).toBe(mockThumbnailUrl);
    });

    it('should display both thumbnail and full image elements', () => {
      const thumbnail = fixture.debugElement.query(By.css('[data-testid="photo-thumbnail"]'));
      const fullImage = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));
      expect(thumbnail).toBeTruthy();
      expect(fullImage).toBeTruthy();
    });

    it('should hide full image until loaded when thumbnail is present', () => {
      const fullImage = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));
      expect(fullImage.nativeElement.classList.contains('hidden')).toBe(true);
    });

    it('should show full image after it loads', () => {
      const fullImage = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));

      // Simulate image load
      fullImage.nativeElement.dispatchEvent(new Event('load'));
      fixture.detectChanges();

      expect(fullImage.nativeElement.classList.contains('hidden')).toBe(false);
    });

    it('should hide thumbnail after full image loads', () => {
      const fullImage = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));

      // Simulate full image load
      fullImage.nativeElement.dispatchEvent(new Event('load'));
      fixture.detectChanges();

      // After full image loads, thumbnail should not be displayed
      const thumbnail = fixture.debugElement.query(By.css('[data-testid="photo-thumbnail"]'));
      expect(thumbnail).toBeNull();
    });
  });

  describe('with PDF content', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(PhotoViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockPdfUrl);
      fixture.componentRef.setInput('contentType', 'application/pdf');
      fixture.detectChanges();
    });

    it('should display PDF placeholder', () => {
      const pdfPlaceholder = fixture.debugElement.query(By.css('[data-testid="pdf-placeholder"]'));
      expect(pdfPlaceholder).toBeTruthy();
    });

    it('should display Open PDF button', () => {
      const openPdfBtn = fixture.debugElement.query(By.css('[data-testid="open-pdf-btn"]'));
      expect(openPdfBtn).toBeTruthy();
    });

    it('should have correct href on Open PDF button', () => {
      const openPdfBtn = fixture.debugElement.query(By.css('[data-testid="open-pdf-btn"]'));
      expect(openPdfBtn.nativeElement.href).toBe(mockPdfUrl);
    });

    it('should not display image viewport for PDF', () => {
      const viewport = fixture.debugElement.query(By.css('[data-testid="image-viewport"]'));
      expect(viewport).toBeNull();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(PhotoViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockImageUrl);
      fixture.componentRef.setInput('contentType', 'image/jpeg');
      fixture.detectChanges();
    });

    it('should show error state when image fails to load', () => {
      const image = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));

      // Simulate error
      image.nativeElement.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      const errorState = fixture.debugElement.query(By.css('[data-testid="error-state"]'));
      expect(errorState).toBeTruthy();
    });

    it('should display retry button in error state', () => {
      const image = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));

      // Simulate error
      image.nativeElement.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      const retryBtn = fixture.debugElement.query(By.css('[data-testid="retry-btn"]'));
      expect(retryBtn).toBeTruthy();
    });

    it('should reset error state on retry', () => {
      const image = fixture.debugElement.query(By.css('[data-testid="photo-image"]'));

      // Simulate error
      image.nativeElement.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      // Click retry
      const retryBtn = fixture.debugElement.query(By.css('[data-testid="retry-btn"]'));
      retryBtn.nativeElement.click();
      fixture.detectChanges();

      const errorState = fixture.debugElement.query(By.css('[data-testid="error-state"]'));
      expect(errorState).toBeNull();
    });
  });

  describe('zoom functionality', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(PhotoViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockImageUrl);
      fixture.componentRef.setInput('contentType', 'image/jpeg');
      fixture.detectChanges();
    });

    it('should disable zoom out button at 50%', () => {
      const zoomOut = fixture.debugElement.query(By.css('[data-testid="zoom-out-btn"]'));

      // Zoom out to 50%
      for (let i = 0; i < 2; i++) {
        zoomOut.nativeElement.click();
        fixture.detectChanges();
      }

      expect(zoomOut.nativeElement.disabled).toBe(true);
    });

    it('should disable zoom in button at 200%', () => {
      const zoomIn = fixture.debugElement.query(By.css('[data-testid="zoom-in-btn"]'));

      // Zoom in to 200%
      for (let i = 0; i < 4; i++) {
        zoomIn.nativeElement.click();
        fixture.detectChanges();
      }

      expect(zoomIn.nativeElement.disabled).toBe(true);
    });
  });
});
