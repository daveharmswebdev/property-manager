import { computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { VendorStore } from '../../stores/vendor.store';
import { VendorTradeTagDto } from '../../../../core/api/api.service';

/**
 * Base class for vendor create and edit forms.
 * Consolidates shared form logic: phone/email/tag management, validation, autocomplete.
 */
export abstract class VendorFormBase {
  protected readonly store = inject(VendorStore);
  protected readonly fb = inject(FormBuilder);

  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;
  protected readonly tagInputControl = this.fb.control('');

  protected form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    phones: this.fb.array([]),
    emails: this.fb.array([]),
  });

  protected selectedTags = signal<VendorTradeTagDto[]>([]);

  protected filteredTags = computed(() => {
    const input = this.tagInputControl.value?.toLowerCase() || '';
    const selectedIds = new Set(this.selectedTags().map(t => t.id));
    return this.store.tradeTags()
      .filter(tag => !selectedIds.has(tag.id))
      .filter(tag => tag.name?.toLowerCase().includes(input));
  });

  get phonesArray(): FormArray {
    return this.form.get('phones') as FormArray;
  }

  get emailsArray(): FormArray {
    return this.form.get('emails') as FormArray;
  }

  /** Concrete classes must provide the tag input element for clearing. */
  protected abstract getTagInputElement(): HTMLInputElement;

  protected addPhone(): void {
    this.phonesArray.push(this.fb.group({
      number: ['', [Validators.required, Validators.maxLength(50)]],
      label: [''],
    }));
  }

  protected removePhone(index: number): void {
    this.phonesArray.removeAt(index);
  }

  protected addEmail(): void {
    this.emailsArray.push(this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(255)]));
  }

  protected removeEmail(index: number): void {
    this.emailsArray.removeAt(index);
  }

  protected selectTag(event: MatAutocompleteSelectedEvent): void {
    const tag = event.option.value as VendorTradeTagDto;
    if (tag.id === null) {
      this.createAndAddTag(tag.name || '');
    } else {
      this.selectedTags.update(tags => [...tags, tag]);
    }
    this.tagInputControl.setValue('');
    this.getTagInputElement().value = '';
  }

  protected addTagFromInput(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value && !this.tagExists(value)) {
      this.createAndAddTag(value);
    }
    event.chipInput?.clear();
    this.tagInputControl.setValue('');
  }

  protected async createAndAddTag(name: string): Promise<void> {
    const newTag = await this.store.createTradeTag(name);
    if (newTag) {
      this.selectedTags.update(tags => [...tags, newTag]);
    }
  }

  protected removeTag(tag: VendorTradeTagDto): void {
    this.selectedTags.update(tags => tags.filter(t => t.id !== tag.id));
  }

  protected tagExists(name: string): boolean {
    const lowerName = name.toLowerCase();
    return this.store.tradeTags().some(t => t.name?.toLowerCase() === lowerName) ||
           this.selectedTags().some(t => t.name?.toLowerCase() === lowerName);
  }

  protected getSelectedTradeTagIds(): string[] {
    return this.selectedTags()
      .filter((t): t is VendorTradeTagDto & { id: string } => t.id != null)
      .map(t => t.id);
  }

  protected getPhonesPayload(): { number: string; label: string | undefined }[] {
    return (this.form.value.phones || []).map((p: { number?: string; label?: string }) => ({
      number: p.number?.trim(),
      label: p.label || undefined,
    }));
  }

  protected getEmailsPayload(): string[] {
    return (this.form.value.emails || []).map((e: string) => e.trim());
  }
}
