import { Injectable, signal, computed } from '@angular/core';

/** localStorage key for persisting selected year */
const STORAGE_KEY = 'propertyManager.selectedYear';

/**
 * Global year selector state management service (AC-3.5.3, AC-3.5.5, AC-7.3.1-5).
 * Provides reactive year selection that persists across page refresh and browser sessions.
 * Year selection persists in localStorage with graceful fallback to current year.
 */
@Injectable({ providedIn: 'root' })
export class YearSelectorService {
  // Private state - initialized to current year, then updated from storage
  private readonly _selectedYear = signal<number>(new Date().getFullYear());

  // Public readonly signals
  readonly selectedYear = this._selectedYear.asReadonly();

  /**
   * Computed signal for available years (AC-3.5.1).
   * Returns current year + 5 previous years in descending order.
   */
  readonly availableYears = computed(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  });

  constructor() {
    this.initializeFromStorage();
  }

  /**
   * Set the selected year (AC-3.5.5, AC-7.3.1, AC-7.3.2).
   * Validates year is within available range before setting.
   * Persists to localStorage for cross-session persistence.
   * @param year The year to select
   */
  setYear(year: number): void {
    if (!this.isValidYear(year)) {
      console.warn(`YearSelectorService: Invalid year ${year}, ignoring`);
      return;
    }
    this._selectedYear.set(year);
    this.saveToStorage(year);
  }

  /**
   * Reset to current year (called on new session/login).
   * Also clears persisted year from localStorage.
   */
  reset(): void {
    const currentYear = new Date().getFullYear();
    this._selectedYear.set(currentYear);
    this.saveToStorage(currentYear);
  }

  /**
   * Initialize year from localStorage on service creation (AC-7.3.1, AC-7.3.2).
   * Falls back to current year if storage is empty, invalid, or unavailable (AC-7.3.3, AC-7.3.4, AC-7.3.5).
   */
  private initializeFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const year = parseInt(stored, 10);
        if (this.isValidYear(year)) {
          this._selectedYear.set(year);
          return;
        }
        // Invalid or out-of-range stored value - log warning and replace (AC-7.3.4, AC-7.3.5)
        console.warn(`YearSelectorService: Invalid stored year "${stored}", falling back to current year`);
      }
      // Fall through: empty or invalid - save current year to normalize storage
      this.saveToStorage(this._selectedYear());
    } catch {
      // localStorage may be unavailable (private browsing, disabled) - AC-7.3.3
      console.warn('YearSelectorService: localStorage unavailable, using default year');
    }
  }

  /**
   * Validate that year is within available range (AC-7.3.5).
   * @param year Year to validate
   * @returns true if year is valid and within available range
   */
  private isValidYear(year: number): boolean {
    if (isNaN(year) || year < 0) return false;
    const availableYears = this.availableYears();
    return availableYears.includes(year);
  }

  /**
   * Save year to localStorage (AC-7.3.1, AC-7.3.2).
   * Logs warning on failure (best-effort persistence).
   * @param year Year to save
   */
  private saveToStorage(year: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, year.toString());
    } catch {
      // May fail in private browsing or if quota exceeded
      console.warn('YearSelectorService: Failed to save year to localStorage');
    }
  }
}
