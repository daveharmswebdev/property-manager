import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Service for generating and downloading tax reports (AC-6.1.2, AC-6.1.3).
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  /**
   * Generates a Schedule E PDF report for a property and year.
   * Returns the PDF as a Blob for preview or download.
   */
  async generateScheduleE(propertyId: string, year: number): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/v1/reports/schedule-e',
        { propertyId, year },
        { responseType: 'blob' }
      )
    );
  }

  /**
   * Triggers a download of the PDF blob with the correct filename (AC-6.1.3).
   * Filename format: Schedule-E-{PropertyName}-{Year}.pdf
   */
  downloadPdf(blob: Blob, propertyName: string, year: number): void {
    // Sanitize property name for filename
    const sanitizedName = propertyName
      .replace(/[^a-zA-Z0-9\-_ ]/g, '')
      .replace(/ /g, '-');
    const filename = `Schedule-E-${sanitizedName}-${year}.pdf`;

    // Create object URL and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
