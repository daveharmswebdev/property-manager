import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { ErrorCardComponent } from './error-card.component';

describe('ErrorCardComponent', () => {
  let component: ErrorCardComponent;
  let fixture: ComponentFixture<ErrorCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorCardComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default message', () => {
    expect(component.message()).toBe('An error occurred. Please try again.');
  });

  it('should have showRetry true by default', () => {
    expect(component.showRetry()).toBe(true);
  });

  it('should have default retryLabel', () => {
    expect(component.retryLabel()).toBe('Try Again');
  });

  it('should render error_outline icon', () => {
    const icon = fixture.debugElement.query(By.css('mat-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('error_outline');
  });

  it('should display the default error message', () => {
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent.trim()).toBe(
      'An error occurred. Please try again.'
    );
  });

  it('should display retry button by default', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeTruthy();
  });

  it('should display default retry label on button', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button.nativeElement.textContent.trim()).toBe('Try Again');
  });

  it('should emit retry event when button is clicked', () => {
    const retrySpy = vi.fn();
    component.retry.subscribe(retrySpy);

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();

    expect(retrySpy).toHaveBeenCalledOnce();
  });

  it('should have error-card class on mat-card', () => {
    const card = fixture.debugElement.query(By.css('.error-card'));
    expect(card).toBeTruthy();
  });
});

describe('ErrorCardComponent with custom message', () => {
  let fixture: ComponentFixture<ErrorCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorCardComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorCardComponent);
    fixture.componentRef.setInput('message', 'Failed to load properties.');
    fixture.detectChanges();
  });

  it('should display custom error message', () => {
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent.trim()).toBe(
      'Failed to load properties.'
    );
  });
});

describe('ErrorCardComponent with showRetry false', () => {
  let fixture: ComponentFixture<ErrorCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorCardComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorCardComponent);
    fixture.componentRef.setInput('showRetry', false);
    fixture.detectChanges();
  });

  it('should not display retry button when showRetry is false', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeNull();
  });
});

describe('ErrorCardComponent with custom retryLabel', () => {
  let fixture: ComponentFixture<ErrorCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorCardComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorCardComponent);
    fixture.componentRef.setInput('retryLabel', 'Reload Data');
    fixture.detectChanges();
  });

  it('should display custom retry label on button', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button.nativeElement.textContent.trim()).toBe('Reload Data');
  });
});
