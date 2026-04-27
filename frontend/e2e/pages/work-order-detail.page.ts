import { type Locator, type Download, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * WorkOrderDetailPage — page object for `/work-orders/:id` (Story 21.8).
 *
 * Verified against `work-order-detail.component.ts`:
 * - Edit/Delete are `<button mat-stroked-button>` inside `.action-buttons`
 *   (lines 113-130). The Edit button uses `[routerLink]` to navigate to
 *   `/work-orders/:id/edit`; the test waits for the URL change.
 * - PDF buttons have `data-testid="preview-pdf-btn"` (line 134) and
 *   `data-testid="download-pdf-btn"` (line 143).
 * - PDF preview dialog: `data-testid="wo-pdf-preview-dialog"`
 *   (`work-order-pdf-preview-dialog.component.ts` line 41).
 * - Photo gallery: `data-testid="photo-grid"` (line 81), photo cards use
 *   `data-testid="photo-card-${id}"` (line 90), and the empty state has
 *   `data-testid="empty-state"` (line 68). The `Add Photo`/`Add First Photo`
 *   buttons toggle the upload zone via the `addPhotoClick` output.
 * - File input: `data-testid="file-input"` (`photo-upload.component.ts` line 50).
 *
 * @extends BasePage
 */
export class WorkOrderDetailPage extends BasePage {
  // ───────────────────────────────────────────────────────────────────────────
  // Locators
  // ───────────────────────────────────────────────────────────────────────────

  /** Page-header Edit button. Anchored to `.action-buttons` to disambiguate. */
  get editButton(): Locator {
    return this.page.locator('.action-buttons button:has-text("Edit")');
  }

  /** Page-header Delete button. */
  get deleteButton(): Locator {
    return this.page.locator('.action-buttons button:has-text("Delete")');
  }

  get previewPdfButton(): Locator {
    return this.page.locator('[data-testid="preview-pdf-btn"]');
  }

  get downloadPdfButton(): Locator {
    return this.page.locator('[data-testid="download-pdf-btn"]');
  }

  get pdfPreviewDialog(): Locator {
    return this.page.locator('[data-testid="wo-pdf-preview-dialog"]');
  }

  /**
   * "Add Photo" or "Add First Photo" button. The gallery emits the same
   * `addPhotoClick` event from both states; the empty-state button is the
   * raised primary button inside `[data-testid="empty-state"]`, while the
   * non-empty state's button lives in the gallery card header. We accept
   * either by matching button text.
   */
  get addPhotoButton(): Locator {
    return this.page.locator(
      'button:has-text("Add Photo"), button:has-text("Add First Photo")',
    );
  }

  /** The hidden file input from `app-photo-upload`. */
  get fileInput(): Locator {
    return this.page.locator('[data-testid="file-input"]');
  }

  /** All photo cards in the gallery grid. */
  get photoCards(): Locator {
    return this.page.locator('[data-testid^="photo-card-"]');
  }

  get descriptionText(): Locator {
    return this.page.locator('.description-text');
  }

  /**
   * The inline status display (the chip-like span inside the mat-select-trigger).
   * Used to verify the rendered status after edit.
   */
  get statusOptionDisplay(): Locator {
    return this.page.locator('.status-section .status-option').first();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation
  // ───────────────────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    throw new Error('Use gotoWorkOrder(id) to navigate to work-order detail');
  }

  async gotoWorkOrder(id: string): Promise<void> {
    await this.page.goto(`/work-orders/${id}`);
    await this.waitForLoading();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Click the Edit button and wait for the route to change to
   * `/work-orders/:id/edit`.
   */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
    await this.page.waitForURL(/\/work-orders\/[a-f0-9-]+\/edit$/);
  }

  /**
   * Click the Delete button and wait for the confirm dialog to open.
   */
  async clickDelete(): Promise<void> {
    await this.deleteButton.click();
    await this.waitForConfirmDialog();
  }

  /**
   * Confirm the delete dialog, asserting the snackbar and waiting for the
   * store's redirect back to `/work-orders` (per `WorkOrderStore.deleteWorkOrder`
   * lines 484-487 — only when delete is triggered from the detail page).
   */
  async confirmDelete(): Promise<void> {
    await this.confirmDialogAction('Work order deleted');
    await this.page.waitForURL('/work-orders');
  }

  /**
   * Click the Preview PDF button and return the matching API response.
   */
  async clickPreviewPdf(): Promise<void> {
    await this.previewPdfButton.click();
  }

  /**
   * Click the Add Photo button to open the upload zone. Idempotent — clicking
   * when already open closes it, so call only when zone should be opened.
   */
  async clickAddPhoto(): Promise<void> {
    await this.addPhotoButton.first().click();
  }

  /**
   * Set the file input directly. The `<input type="file" hidden>` is always
   * present in the DOM (verified `photo-upload.component.ts` line 49), so
   * `setInputFiles` works without first opening the zone.
   */
  async uploadPhoto(buffer: Buffer, name = 'test.jpg', mime = 'image/jpeg'): Promise<void> {
    await this.fileInput.setInputFiles({
      name,
      mimeType: mime,
      buffer,
    });
  }

  /**
   * Wait for the PDF preview dialog to be visible.
   */
  async expectPreviewDialogVisible(): Promise<void> {
    await expect(this.pdfPreviewDialog).toBeVisible();
  }
}
