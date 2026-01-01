import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ReceiptImageViewerComponent } from './receipt-image-viewer.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ReceiptImageViewerComponent', () => {
  let component: ReceiptImageViewerComponent;
  let fixture: ComponentFixture<ReceiptImageViewerComponent>;

  const mockImageUrl = 'https://s3.amazonaws.com/test-image.jpg';
  const mockPdfUrl = 'https://s3.amazonaws.com/test-doc.pdf';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptImageViewerComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  describe('with image content', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptImageViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockImageUrl);
      fixture.componentRef.setInput('contentType', 'image/jpeg');
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should display viewer controls', () => {
      const controls = fixture.debugElement.query(
        By.css('[data-testid="viewer-controls"]')
      );
      expect(controls).toBeTruthy();
    });

    it('should display zoom buttons', () => {
      const zoomIn = fixture.debugElement.query(
        By.css('[data-testid="zoom-in-btn"]')
      );
      const zoomOut = fixture.debugElement.query(
        By.css('[data-testid="zoom-out-btn"]')
      );
      expect(zoomIn).toBeTruthy();
      expect(zoomOut).toBeTruthy();
    });

    it('should display rotate buttons', () => {
      const rotateLeft = fixture.debugElement.query(
        By.css('[data-testid="rotate-left-btn"]')
      );
      const rotateRight = fixture.debugElement.query(
        By.css('[data-testid="rotate-right-btn"]')
      );
      expect(rotateLeft).toBeTruthy();
      expect(rotateRight).toBeTruthy();
    });

    it('should display reset button', () => {
      const reset = fixture.debugElement.query(
        By.css('[data-testid="reset-btn"]')
      );
      expect(reset).toBeTruthy();
    });

    it('should display zoom level at 100%', () => {
      const zoomLevel = fixture.debugElement.query(
        By.css('[data-testid="zoom-level"]')
      );
      expect(zoomLevel.nativeElement.textContent).toContain('100%');
    });

    it('should display image viewport', () => {
      const viewport = fixture.debugElement.query(
        By.css('[data-testid="image-viewport"]')
      );
      expect(viewport).toBeTruthy();
    });

    it('should not display PDF placeholder for image', () => {
      const pdfPlaceholder = fixture.debugElement.query(
        By.css('[data-testid="pdf-placeholder"]')
      );
      expect(pdfPlaceholder).toBeNull();
    });

    it('should increase zoom on zoom in click', () => {
      const zoomIn = fixture.debugElement.query(
        By.css('[data-testid="zoom-in-btn"]')
      );
      zoomIn.nativeElement.click();
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(
        By.css('[data-testid="zoom-level"]')
      );
      expect(zoomLevel.nativeElement.textContent).toContain('125%');
    });

    it('should decrease zoom on zoom out click', () => {
      const zoomOut = fixture.debugElement.query(
        By.css('[data-testid="zoom-out-btn"]')
      );
      zoomOut.nativeElement.click();
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(
        By.css('[data-testid="zoom-level"]')
      );
      expect(zoomLevel.nativeElement.textContent).toContain('75%');
    });

    it('should not exceed max zoom of 200%', () => {
      const zoomIn = fixture.debugElement.query(
        By.css('[data-testid="zoom-in-btn"]')
      );
      // Click 5 times (100 -> 125 -> 150 -> 175 -> 200 -> 200)
      for (let i = 0; i < 5; i++) {
        zoomIn.nativeElement.click();
      }
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(
        By.css('[data-testid="zoom-level"]')
      );
      expect(zoomLevel.nativeElement.textContent).toContain('200%');
    });

    it('should not go below min zoom of 50%', () => {
      const zoomOut = fixture.debugElement.query(
        By.css('[data-testid="zoom-out-btn"]')
      );
      // Click 3 times (100 -> 75 -> 50 -> 50)
      for (let i = 0; i < 3; i++) {
        zoomOut.nativeElement.click();
      }
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(
        By.css('[data-testid="zoom-level"]')
      );
      expect(zoomLevel.nativeElement.textContent).toContain('50%');
    });

    it('should reset view on reset button click', () => {
      // First zoom in
      const zoomIn = fixture.debugElement.query(
        By.css('[data-testid="zoom-in-btn"]')
      );
      zoomIn.nativeElement.click();
      fixture.detectChanges();

      // Then reset
      const reset = fixture.debugElement.query(
        By.css('[data-testid="reset-btn"]')
      );
      reset.nativeElement.click();
      fixture.detectChanges();

      const zoomLevel = fixture.debugElement.query(
        By.css('[data-testid="zoom-level"]')
      );
      expect(zoomLevel.nativeElement.textContent).toContain('100%');
    });
  });

  describe('with PDF content', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptImageViewerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('viewUrl', mockPdfUrl);
      fixture.componentRef.setInput('contentType', 'application/pdf');
      fixture.detectChanges();
    });

    it('should display PDF placeholder', () => {
      const pdfPlaceholder = fixture.debugElement.query(
        By.css('[data-testid="pdf-placeholder"]')
      );
      expect(pdfPlaceholder).toBeTruthy();
    });

    it('should display Open PDF button', () => {
      const openPdfBtn = fixture.debugElement.query(
        By.css('[data-testid="open-pdf-btn"]')
      );
      expect(openPdfBtn).toBeTruthy();
    });

    it('should have correct href on Open PDF button', () => {
      const openPdfBtn = fixture.debugElement.query(
        By.css('[data-testid="open-pdf-btn"]')
      );
      expect(openPdfBtn.nativeElement.href).toBe(mockPdfUrl);
    });

    it('should not display image viewport for PDF', () => {
      const viewport = fixture.debugElement.query(
        By.css('[data-testid="image-viewport"]')
      );
      expect(viewport).toBeNull();
    });
  });
});
