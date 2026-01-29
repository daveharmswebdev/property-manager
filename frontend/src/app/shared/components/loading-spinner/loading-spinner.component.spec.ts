import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { LoadingSpinnerComponent } from './loading-spinner.component';

describe('LoadingSpinnerComponent', () => {
  let component: LoadingSpinnerComponent;
  let fixture: ComponentFixture<LoadingSpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingSpinnerComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingSpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default diameter of 40', () => {
    expect(component.diameter()).toBe(40);
  });

  it('should render mat-spinner element', () => {
    const spinner = fixture.debugElement.query(By.css('mat-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('should have loading-container wrapper', () => {
    const container = fixture.debugElement.query(By.css('.loading-container'));
    expect(container).toBeTruthy();
  });

});

describe('LoadingSpinnerComponent with custom diameter', () => {
  let fixture: ComponentFixture<LoadingSpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingSpinnerComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingSpinnerComponent);
    fixture.componentRef.setInput('diameter', 80);
    fixture.detectChanges();
  });

  it('should accept custom diameter input', () => {
    expect(fixture.componentInstance.diameter()).toBe(80);
  });
});
