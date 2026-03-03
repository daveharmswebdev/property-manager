/**
 * Shared styles for vendor create and edit forms.
 * Used by both VendorFormComponent and VendorEditComponent.
 */
export const VENDOR_FORM_SHARED_STYLES = `
  .form-section {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e0e0e0;
  }

  .form-section h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 500;
    color: #666;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-header h3 {
    margin: 0;
  }

  .name-row {
    display: flex;
    gap: 16px;
  }

  .name-field {
    flex: 1;
  }

  .phone-row, .email-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .phone-number {
    flex: 2;
  }

  .phone-label {
    flex: 1;
  }

  .email-field {
    flex: 1;
  }

  .array-items {
    margin-top: 8px;
  }

  .empty-message {
    color: #999;
    font-style: italic;
    margin: 8px 0;
  }

  .full-width {
    width: 100%;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
  }

  .button-spinner {
    display: inline-block;
    margin-right: 8px;
  }

  .button-spinner {
    --mdc-circular-progress-active-indicator-color: white;
  }

  .create-option {
    color: #1976d2;
    font-weight: 500;
  }

  .create-option mat-icon {
    margin-right: 8px;
  }

  @media (max-width: 600px) {
    .name-row {
      flex-direction: column;
    }

    .phone-row {
      flex-wrap: wrap;
    }

    .phone-number, .phone-label {
      flex: 1 1 100%;
    }
  }
`;
