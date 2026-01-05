import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import {
  ApiClient,
  GeneratedReportDto,
} from '../../../core/api/api.service';

/**
 * Reports Store State Interface (AC-6.3.1, AC-6.3.2, AC-6.3.3, AC-6.3.4)
 */
interface ReportsState {
  generatedReports: GeneratedReportDto[];
  isLoading: boolean;
  isDeleting: boolean;
  error: string | null;
}

/**
 * Initial state for reports store
 */
const initialState: ReportsState = {
  generatedReports: [],
  isLoading: false,
  isDeleting: false,
  error: null,
};

/**
 * ReportsStore (AC-6.3.1, AC-6.3.2, AC-6.3.3, AC-6.3.4)
 *
 * State management for generated reports using @ngrx/signals.
 * Provides:
 * - List of generated reports with loading/error states
 * - Methods to load, download, and delete reports
 * - Reports are sorted by generatedAt descending (newest first)
 */
export const ReportsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Count of generated reports
     */
    reportCount: computed(() => store.generatedReports().length),

    /**
     * Whether there are no generated reports
     */
    isEmpty: computed(
      () => !store.isLoading() && store.generatedReports().length === 0
    ),

    /**
     * Whether we have reports loaded (not loading and not empty)
     */
    hasReports: computed(
      () => !store.isLoading() && store.generatedReports().length > 0
    ),
  })),
  withMethods((store, api = inject(ApiClient)) => ({
    /**
     * Load all generated reports from API (AC-6.3.1)
     * Reports are returned sorted by generatedAt descending (newest first)
     */
    async loadReports(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      try {
        const reports = await firstValueFrom(api.reports_GetReports());
        patchState(store, {
          generatedReports: reports || [],
          isLoading: false,
        });
      } catch (error) {
        console.error('Error loading generated reports:', error);
        patchState(store, {
          isLoading: false,
          error: 'Failed to load reports',
        });
      }
    },

    /**
     * Download a report (AC-6.3.2)
     * @param report The report to download
     * @returns true if download succeeded, false otherwise
     */
    async downloadReport(report: GeneratedReportDto): Promise<boolean> {
      if (!report.id) return false;

      try {
        const response = await firstValueFrom(
          api.reports_DownloadReport(report.id)
        );

        // Trigger browser download
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = report.fileName || 'report.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      } catch (error) {
        console.error('Error downloading report:', error);
        patchState(store, { error: 'Failed to download report' });
        return false;
      }
    },

    /**
     * Delete a report (AC-6.3.3)
     * @param reportId The ID of the report to delete
     */
    async deleteReport(reportId: string): Promise<boolean> {
      patchState(store, { isDeleting: true, error: null });
      try {
        await firstValueFrom(api.reports_DeleteReport(reportId));

        // Remove from local state (optimistic update already applied by UI)
        patchState(store, (state) => ({
          generatedReports: state.generatedReports.filter(
            (r) => r.id !== reportId
          ),
          isDeleting: false,
        }));
        return true;
      } catch (error) {
        console.error('Error deleting report:', error);
        patchState(store, {
          isDeleting: false,
          error: 'Failed to delete report',
        });
        return false;
      }
    },

    /**
     * Add a newly generated report to the store (optimistic update)
     * Called after generating a new report to avoid full reload
     */
    addReport(report: GeneratedReportDto): void {
      patchState(store, (state) => ({
        // Add to beginning since it's newest
        generatedReports: [report, ...state.generatedReports],
      }));
    },

    /**
     * Fetches the PDF/ZIP blob for a stored report (AC-6.4.1).
     * Used for preview functionality.
     * @param id The report ID
     * @returns The report blob
     */
    async getReportBlob(id: string): Promise<Blob> {
      const response = await firstValueFrom(api.reports_DownloadReport(id));
      // The NSwag client returns FileResponse with data as Blob
      return response.data;
    },

    /**
     * Clear error state
     */
    clearError(): void {
      patchState(store, { error: null });
    },

    /**
     * Reset store to initial state
     */
    reset(): void {
      patchState(store, initialState);
    },
  }))
);
