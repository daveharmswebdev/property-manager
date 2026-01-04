import { Component, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * PDF Preview Component (AC-6.1.2)
 * Displays a PDF in an embedded viewer using the browser's native PDF rendering.
 * Falls back to a download link if PDF preview is not supported.
 */
@Component({
  selector: 'app-pdf-preview',
  standalone: true,
  template: `
    <div class="pdf-container" data-testid="pdf-preview-container">
      <object [data]="pdfUrl()" type="application/pdf" width="100%" height="100%">
        <p class="fallback-message">
          Your browser doesn't support PDF preview.
          <a [href]="pdfUrl()" target="_blank" data-testid="pdf-download-fallback">Download the PDF</a> instead.
        </p>
      </object>
    </div>
  `,
  styles: [`
    .pdf-container {
      width: 100%;
      height: 100%;
      min-height: 400px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      background-color: #f5f5f5;
    }

    .fallback-message {
      text-align: center;
      padding: 24px;
      color: var(--pm-text-secondary, #666);

      a {
        color: var(--pm-primary, #2e7d32);
        text-decoration: underline;
      }
    }
  `]
})
export class PdfPreviewComponent {
  /**
   * The URL of the PDF to display (object URL from Blob).
   */
  pdfUrl = input.required<SafeResourceUrl>();
}
