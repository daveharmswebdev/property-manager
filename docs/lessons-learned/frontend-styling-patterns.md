# Frontend Styling Patterns & Lessons Learned

> Hard-won styling wisdom from building the Property Manager Angular frontend.

## Angular Material Dialog Styling

### Problem: Dialog Content Touching Edges / Scrollbar Appearing

**Symptom:** Modal dialogs display content (icons, buttons) flush against the edges with unwanted scrollbars.

**Root Cause:** Angular Material dialogs have default padding on `mat-dialog-content` and `mat-dialog-actions`, but if you wrap content in a custom container, you need to manage padding yourself. The Material dialog surface may also have default padding that conflicts with custom styles.

**Solution:**

1. **Use a custom `panelClass`** when opening the dialog to control the panel styling:

```typescript
this.dialog.open(ConfirmDialogComponent, {
  data: dialogData,
  width: '450px',
  panelClass: 'confirm-dialog-panel',  // Custom class for panel overrides
});
```

2. **Add global styles** to override Material's default panel padding (in `styles.scss`):

```scss
.confirm-dialog-panel {
  .mat-mdc-dialog-container {
    .mdc-dialog__surface {
      padding: 0;        // Remove default padding
      overflow: hidden;  // Prevent scrollbars
    }
  }
}
```

3. **Control padding in the component wrapper**:

```scss
.confirm-dialog {
  min-width: 350px;
  max-width: 450px;
  padding: 24px;        // Consistent padding on all sides
  overflow: hidden;     // Prevent scrollbar
}
```

4. **Reset Material directive padding** to prevent double-padding:

```scss
mat-dialog-content {
  padding: 0;
  margin: 0;
  overflow: visible;  // Allow content to flow naturally
}

mat-dialog-actions {
  padding: 24px 0 0 0;  // Only top padding for spacing
  margin: 0;
}
```

---

### Problem: Icon and Text Misalignment in Headers

**Symptom:** When placing a Material icon next to a title (e.g., warning icon + "Delete Property?"), the icon appears vertically centered while the text baseline sits lower, creating visual imbalance.

**Root Cause:** `align-items: center` aligns items to their vertical center, but text has a baseline that sits above its bounding box bottom. Icons have no natural baseline.

**Solution:** Use `align-items: flex-end` to align both elements to the bottom, with a small margin adjustment on the icon:

```scss
.dialog-header {
  display: flex;
  align-items: flex-end;  // Align to bottom
  gap: 12px;
  margin-bottom: 16px;

  .header-icon {
    font-size: 28px;
    width: 28px;
    height: 28px;
    margin-bottom: 2px;  // Optical adjustment for text descender space
  }

  h2 {
    margin: 0;
    padding: 0;
  }
}
```

**Why `margin-bottom: 2px`?** Text has descender space below the baseline (for letters like g, y, p). The small margin lifts the icon slightly to align with the visual baseline of capital letters.

---

## Reusable Component Patterns

### Confirmation Dialogs

When building confirmation modals, make them reusable from the start:

```typescript
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  // Optional enhancements
  icon?: string;                              // Material icon name
  iconColor?: 'warn' | 'primary' | 'accent';  // Color variant
  secondaryMessage?: string;                  // Additional context
  confirmIcon?: string;                       // Icon on confirm button
}
```

**Usage for delete confirmation:**
```typescript
const dialogData: ConfirmDialogData = {
  title: `Delete ${property.name}?`,
  message: 'This will remove the property from your active portfolio.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  icon: 'warning',
  iconColor: 'warn',
  secondaryMessage: 'Historical records will be preserved for tax purposes.',
  confirmIcon: 'delete',
};
```

**Usage for unsaved changes:**
```typescript
const dialogData: ConfirmDialogData = {
  title: 'Unsaved Changes',
  message: 'You have unsaved changes. Discard changes?',
  confirmText: 'Discard',
  cancelText: 'Cancel',
};
```

---

## CSS Architecture Principles

### 1. Component Controls Its Own Padding
Let the component's root wrapper control all internal padding rather than relying on parent/framework defaults.

### 2. Override Framework Defaults Explicitly
When using component libraries like Angular Material, explicitly reset any default padding/margin that conflicts with your design.

### 3. Use Global Panel Classes for Dialogs
Dialog panels exist outside component scope. Use `panelClass` + global styles to control panel-level styling.

### 4. Flexbox Alignment Choices

| Use Case | Property |
|----------|----------|
| Center items vertically | `align-items: center` |
| Align text + icon to bottom | `align-items: flex-end` |
| Align by text baseline | `align-items: baseline` (limited icon support) |
| Top align items | `align-items: flex-start` |

### 5. Optical Adjustments Are Normal
Small pixel adjustments (1-3px) for visual alignment are common and expected. Document why they exist.

---

## Quick Reference: Dialog Styling Checklist

- [ ] Custom `panelClass` added to dialog config
- [ ] Global styles override `.mdc-dialog__surface` padding
- [ ] Component wrapper has explicit padding
- [ ] `mat-dialog-content` and `mat-dialog-actions` padding reset
- [ ] `overflow: hidden` on wrapper to prevent scrollbars
- [ ] Icon/text alignment uses `flex-end` with optical adjustment
- [ ] Component is reusable with optional configuration

---

*Last updated: December 2024 - Confirmation Modal Styling Bug Fix*
