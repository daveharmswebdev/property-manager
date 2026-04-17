import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { SubmitRequestComponent } from './submit-request.component';
import { TenantDashboardStore } from '../../stores/tenant-dashboard.store';

describe('SubmitRequestComponent', () => {
  let component: SubmitRequestComponent;
  let fixture: ComponentFixture<SubmitRequestComponent>;
  let storeMock: {
    isSubmitting: ReturnType<typeof signal<boolean>>;
    submitError: ReturnType<typeof signal<string | null>>;
    submitRequest: ReturnType<typeof vi.fn>;
    uploadPhoto: ReturnType<typeof vi.fn>;
    clearSubmitError: ReturnType<typeof vi.fn>;
    loadRequests: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeMock = {
      isSubmitting: signal(false),
      submitError: signal<string | null>(null),
      submitRequest: vi.fn().mockResolvedValue('new-req-1'),
      uploadPhoto: vi.fn().mockResolvedValue(true),
      clearSubmitError: vi.fn(),
      loadRequests: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SubmitRequestComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: TenantDashboardStore, useValue: storeMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Task 9.1: component renders description textarea and submit button (AC #1)
  it('should render description textarea and submit button', () => {
    const textarea = fixture.debugElement.query(By.css('textarea[formControlName="description"]'));
    expect(textarea).toBeTruthy();

    const submitBtn = fixture.debugElement.query(By.css('[data-testid="submit-btn"]'));
    expect(submitBtn).toBeTruthy();
  });

  // Task 9.2: submit button disabled when description is empty (AC #6)
  it('should disable submit button when description is empty', () => {
    const submitBtn = fixture.debugElement.query(
      By.css('[data-testid="submit-btn"]'),
    ).nativeElement;
    expect(submitBtn.disabled).toBe(true);
  });

  // Task 9.3: calls store.submitRequest on form submission (AC #2)
  it('should call store.submitRequest on form submission', async () => {
    component.form.controls.description.setValue('Leaky faucet in kitchen');
    fixture.detectChanges();

    const submitBtn = fixture.debugElement.query(
      By.css('[data-testid="submit-btn"]'),
    ).nativeElement;
    submitBtn.click();
    await fixture.whenStable();

    expect(storeMock.submitRequest).toHaveBeenCalledWith('Leaky faucet in kitchen');
  });

  // Task 9.4: shows photo upload area after successful submission (AC #3)
  it('should show photo upload area after successful submission', async () => {
    component.form.controls.description.setValue('Broken window');
    fixture.detectChanges();

    await component.onSubmit();
    fixture.detectChanges();

    const photoUpload = fixture.debugElement.query(By.css('app-photo-upload'));
    expect(photoUpload).toBeTruthy();

    const doneBtn = fixture.debugElement.query(By.css('[data-testid="done-btn"]'));
    expect(doneBtn).toBeTruthy();
  });

  // Task 9.5: shows validation error when description is empty and form is touched (AC #6)
  it('should show validation error when description is empty and touched', () => {
    component.form.controls.description.markAsTouched();
    fixture.detectChanges();

    const matError = fixture.debugElement.query(By.css('mat-error'));
    expect(matError).toBeTruthy();
    expect(matError.nativeElement.textContent).toContain('Description is required');
  });
});
