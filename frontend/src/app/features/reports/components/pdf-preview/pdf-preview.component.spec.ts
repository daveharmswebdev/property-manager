import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DomSanitizer } from '@angular/platform-browser';
import { By } from '@angular/platform-browser';
import { PdfPreviewComponent } from './pdf-preview.component';

/**
 * Unit tests for PdfPreviewComponent (AC-6.1.2)
 *
 * Test coverage:
 * - Component creation
 * - PDF container display
 * - Fallback message display
 * - Download link presence
 */
describe('PdfPreviewComponent', () => {
  let component: PdfPreviewComponent;
  let fixture: ComponentFixture<PdfPreviewComponent>;
  let sanitizer: DomSanitizer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPreviewComponent],
    }).compileComponents();

    sanitizer = TestBed.inject(DomSanitizer);
    fixture = TestBed.createComponent(PdfPreviewComponent);
    component = fixture.componentInstance;

    // Set required input with sanitized URL
    const mockUrl = sanitizer.bypassSecurityTrustResourceUrl('blob:http://localhost/mock-pdf-url');
    fixture.componentRef.setInput('pdfUrl', mockUrl);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render pdf-container', () => {
    const container = fixture.debugElement.query(By.css('.pdf-container'));
    expect(container).toBeTruthy();
  });

  it('should have data-testid attribute on container', () => {
    const container = fixture.debugElement.query(By.css('[data-testid="pdf-preview-container"]'));
    expect(container).toBeTruthy();
  });

  it('should render object element for PDF embedding', () => {
    const objectEl = fixture.debugElement.query(By.css('object'));
    expect(objectEl).toBeTruthy();
    expect(objectEl.nativeElement.getAttribute('type')).toBe('application/pdf');
  });

  it('should set object width and height to 100%', () => {
    const objectEl = fixture.debugElement.query(By.css('object'));
    expect(objectEl.nativeElement.getAttribute('width')).toBe('100%');
    expect(objectEl.nativeElement.getAttribute('height')).toBe('100%');
  });

  it('should render fallback message', () => {
    const fallback = fixture.debugElement.query(By.css('.fallback-message'));
    expect(fallback).toBeTruthy();
    expect(fallback.nativeElement.textContent).toContain("browser doesn't support PDF preview");
  });

  it('should render download fallback link', () => {
    const link = fixture.debugElement.query(By.css('[data-testid="pdf-download-fallback"]'));
    expect(link).toBeTruthy();
    expect(link.nativeElement.textContent).toContain('Download the PDF');
    expect(link.nativeElement.getAttribute('target')).toBe('_blank');
  });
});
