import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Service for generating and downloading tax reports (AC-6.1.2, AC-6.1.3, AC-6.2.4, AC-6.2.5).
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
   * Generates Schedule E PDF reports for multiple properties as a ZIP bundle (AC-6.2.4).
   * @param propertyIds Array of property GUIDs
   * @param year Tax year
   * @returns ZIP file as Blob
   */
  async generateBatchScheduleE(propertyIds: string[], year: number): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/v1/reports/schedule-e/batch',
        { propertyIds, year },
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
    this.triggerDownload(blob, filename);
  }

  /**
   * Triggers a download of the ZIP bundle with the correct filename (AC-6.2.5).
   * Filename format: Schedule-E-Reports-{Year}.zip
   */
  downloadZip(blob: Blob, year: number): void {
    const filename = `Schedule-E-Reports-${year}.zip`;
    this.triggerDownload(blob, filename);
  }

  /**
   * Common download trigger logic.
   */
  private triggerDownload(blob: Blob, filename: string): void {
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
