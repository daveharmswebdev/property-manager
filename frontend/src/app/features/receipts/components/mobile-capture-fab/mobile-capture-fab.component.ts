import { Component, ElementRef, inject, signal, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject, takeUntil, firstValueFrom, filter } from 'rxjs';
import { ReceiptCaptureService } from '../../services/receipt-capture.service';
import { PropertyTagModalComponent, PropertyTagResult } from '../property-tag-modal/property-tag-modal.component';

/**
 * Mobile Capture FAB Component (AC-5.2.1)
 *
 * Floating action button for quick receipt capture on mobile devices.
 * - Only visible on mobile viewports (< 768px) AND on Dashboard route
 * - Positioned bottom-right, above bottom navigation
 * - Triggers camera/file picker for receipt capture
 */
@Component({
  selector: 'app-mobile-capture-fab',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    @if (isMobile() && isOnDashboard()) {
      <button
        mat-fab
        class="capture-fab"
        (click)="onFabClick()"
        aria-label="Capture receipt"
        [disabled]="isUploading()"
      >
        <mat-icon>{{ isUploading() ? 'hourglass_empty' : 'photo_camera' }}</mat-icon>
      </button>

      <input
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        capture="environment"
        (change)="onFileSelected($event)"
        #fileInput
        style="display: none"
      >
    }
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: 80px;
      right: 16px;
      z-index: 1000;
    }

    .capture-fab {
      background-color: var(--pm-primary, #66BB6A);
      color: white;

      &:hover {
        background-color: var(--pm-primary-dark, #4CAF50);
      }

      &:disabled {
        background-color: var(--pm-disabled, #9E9E9E);
      }
    }
  `],
})
export class MobileCaptureFabComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly receiptCaptureService = inject(ReceiptCaptureService);
  private readonly destroy$ = new Subject<void>();

  readonly isMobile = signal(false);
  readonly isUploading = signal(false);
  /** FAB should only appear on Dashboard route */
  readonly isOnDashboard = signal(false);

  private pendingFile: File | null = null;
  private pendingPropertyId: string | undefined = undefined;
  private activeSnackBarRef: MatSnackBarRef<TextOnlySnackBar> | null = null;

  ngOnInit(): void {
    // Breakpoint detection for mobile viewport
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isMobile.set(result.matches);
      });

    // Check initial route
    this.isOnDashboard.set(this.router.url === '/dashboard');

    // Listen for route changes to show FAB only on Dashboard
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.isOnDashboard.set(event.url === '/dashboard');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * FAB click handler - triggers file input for camera capture (AC-5.2.1)
   */
  onFabClick(): void {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.click();
    }
  }

  /**
   * Handle file selection from camera or gallery (AC-5.2.2, AC-5.2.6)
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    // Reset file input for next capture
    input.value = '';

    // Validate file type (AC-5.2.6)
    if (!this.receiptCaptureService.isValidFileType(file.type)) {
      this.showError('Invalid file type. Please use JPEG, PNG, or PDF.');
      return;
    }

    // Validate file size
    if (!this.receiptCaptureService.isValidFileSize(file.size)) {
      this.showError('File too large. Maximum size is 10MB.');
      return;
    }

    // Store file for potential retry
    this.pendingFile = file;

    // Open property tag modal (AC-5.2.3)
    const dialogRef = this.dialog.open(PropertyTagModalComponent, {
      width: '300px',
      disableClose: false,
    });

    const result: PropertyTagResult | undefined = await firstValueFrom(dialogRef.afterClosed());

    // User cancelled modal
    if (result === undefined) {
      this.pendingFile = null;
      this.pendingPropertyId = undefined;
      return;
    }

    // Store propertyId for potential retry (AC-5.2.5)
    this.pendingPropertyId = result.propertyId || undefined;

    // Upload receipt (AC-5.2.2, AC-5.2.5)
    await this.uploadReceipt(file, this.pendingPropertyId);
  }

  /**
   * Upload receipt to S3 (AC-5.2.2, AC-5.2.5)
   */
  private async uploadReceipt(file: File, propertyId?: string): Promise<void> {
    this.isUploading.set(true);

    try {
      await this.receiptCaptureService.uploadReceipt(file, propertyId);
      this.showSuccess('Saved');
      this.pendingFile = null;
      this.pendingPropertyId = undefined;
    } catch {
      this.showErrorWithRetry('Upload failed. Retry?');
    } finally {
      this.isUploading.set(false);
    }
  }

  /**
   * Retry last failed upload with preserved propertyId (AC-5.2.5)
   */
  private async retryUpload(): Promise<void> {
    if (this.pendingFile) {
      await this.uploadReceipt(this.pendingFile, this.pendingPropertyId);
    }
  }

  /**
   * Show success snackbar (AC-5.2.2)
   */
  private showSuccess(message: string): void {
    this.snackBar.open(message, '', {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  /**
   * Show error snackbar
   */
  private showError(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  /**
   * Show error snackbar with retry action (AC-5.2.5)
   */
  private showErrorWithRetry(message: string): void {
    this.activeSnackBarRef = this.snackBar.open(message, 'Retry', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });

    this.activeSnackBarRef.onAction().subscribe(() => {
      this.retryUpload();
    });
  }
}
