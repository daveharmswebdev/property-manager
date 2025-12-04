import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { type TestProperty } from '../helpers/test-data.helper';

export class PropertyFormPage extends BasePage {
  readonly nameInput: Locator;
  readonly streetInput: Locator;
  readonly cityInput: Locator;
  readonly stateSelect: Locator;
  readonly zipCodeInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.locator('input[formControlName="name"]');
    this.streetInput = page.locator('input[formControlName="street"]');
    this.cityInput = page.locator('input[formControlName="city"]');
    this.stateSelect = page.locator('mat-select[formControlName="state"]');
    this.zipCodeInput = page.locator('input[formControlName="zipCode"]');
    this.saveButton = page.locator('button[type="submit"]');
    this.cancelButton = page.locator('button', { hasText: 'Cancel' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/properties/new');
  }

  async fillForm(property: TestProperty): Promise<void> {
    await this.nameInput.fill(property.name);
    await this.streetInput.fill(property.street);
    await this.cityInput.fill(property.city);

    await this.stateSelect.click();
    await this.page.locator('mat-option').filter({ hasText: property.state }).click();

    await this.zipCodeInput.fill(property.zipCode);
  }

  async submit(): Promise<void> {
    await this.saveButton.click();
  }
}
