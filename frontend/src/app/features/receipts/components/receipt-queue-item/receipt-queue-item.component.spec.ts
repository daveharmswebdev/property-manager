import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ReceiptQueueItemComponent } from './receipt-queue-item.component';
import { UnprocessedReceiptDto } from '../../../../core/api/api.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ReceiptQueueItemComponent', () => {
  let component: ReceiptQueueItemComponent;
  let fixture: ComponentFixture<ReceiptQueueItemComponent>;

  const mockImageReceipt: UnprocessedReceiptDto = {
    id: 'receipt-1',
    createdAt: new Date(),
    propertyId: 'property-1',
    propertyName: 'Oak Street Duplex',
    contentType: 'image/jpeg',
    viewUrl: 'https://s3.amazonaws.com/test-image.jpg',
  };

  const mockPdfReceipt: UnprocessedReceiptDto = {
    id: 'receipt-2',
    createdAt: new Date(),
    propertyId: 'property-2',
    propertyName: 'Maple Ave Condo',
    contentType: 'application/pdf',
    viewUrl: 'https://s3.amazonaws.com/test-doc.pdf',
  };

  const mockUnassignedReceipt: UnprocessedReceiptDto = {
    id: 'receipt-3',
    createdAt: new Date(),
    propertyId: undefined,
    propertyName: undefined,
    contentType: 'image/png',
    viewUrl: 'https://s3.amazonaws.com/test-image.png',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptQueueItemComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  describe('with image receipt', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptQueueItemComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('receipt', mockImageReceipt);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should display thumbnail image', () => {
      const img = fixture.debugElement.query(By.css('.receipt-thumb'));
      expect(img).toBeTruthy();
      expect(img.nativeElement.src).toBe(mockImageReceipt.viewUrl);
    });

    it('should not show PDF icon for image receipt', () => {
      const pdfIcon = fixture.debugElement.query(By.css('.pdf-icon'));
      expect(pdfIcon).toBeNull();
    });

    it('should display property name', () => {
      const propertyEl = fixture.debugElement.query(
        By.css('[data-testid="receipt-property"]')
      );
      expect(propertyEl.nativeElement.textContent.trim()).toBe(
        'Oak Street Duplex'
      );
    });

    it('should display formatted date', () => {
      const dateEl = fixture.debugElement.query(
        By.css('[data-testid="receipt-date"]')
      );
      expect(dateEl.nativeElement.textContent).toBeTruthy();
      // Should contain some form of relative time like "less than a minute ago"
    });

    it('should emit clicked event on click', () => {
      const clickSpy = vi.fn();
      component.clicked.subscribe(clickSpy);

      const card = fixture.debugElement.query(
        By.css('[data-testid="receipt-queue-item"]')
      );
      card.nativeElement.click();

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('with PDF receipt', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptQueueItemComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('receipt', mockPdfReceipt);
      fixture.detectChanges();
    });

    it('should display PDF icon instead of image', () => {
      const pdfIcon = fixture.debugElement.query(By.css('.pdf-icon'));
      expect(pdfIcon).toBeTruthy();
    });

    it('should not display thumbnail image for PDF', () => {
      const img = fixture.debugElement.query(By.css('.receipt-thumb'));
      expect(img).toBeNull();
    });

    it('should correctly identify as PDF', () => {
      expect(component.isPdf()).toBe(true);
    });
  });

  describe('with unassigned receipt', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptQueueItemComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('receipt', mockUnassignedReceipt);
      fixture.detectChanges();
    });

    it('should display "(unassigned)" for null property', () => {
      const propertyEl = fixture.debugElement.query(
        By.css('[data-testid="receipt-property"]')
      );
      expect(propertyEl.nativeElement.textContent.trim()).toBe('(unassigned)');
    });

    it('should have unassigned class on property element', () => {
      const propertyEl = fixture.debugElement.query(
        By.css('[data-testid="receipt-property"]')
      );
      expect(propertyEl.nativeElement.classList).toContain('unassigned');
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(ReceiptQueueItemComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('receipt', mockImageReceipt);
      fixture.detectChanges();
    });

    it('should compute isPdf correctly for image', () => {
      expect(component.isPdf()).toBe(false);
    });

    it('should compute formattedDate', () => {
      expect(component.formattedDate()).toBeTruthy();
      // Should be a relative time string
      expect(typeof component.formattedDate()).toBe('string');
    });
  });
});
