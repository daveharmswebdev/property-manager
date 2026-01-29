import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default icon of home_work', () => {
    expect(component.icon()).toBe('home_work');
  });

  it('should have default title', () => {
    expect(component.title()).toBe('No items yet');
  });

  it('should have default message', () => {
    expect(component.message()).toBe('Add your first item to get started.');
  });

  it('should have null actionLabel by default', () => {
    expect(component.actionLabel()).toBeNull();
  });

  it('should have null actionRoute by default', () => {
    expect(component.actionRoute()).toBeNull();
  });

  it('should have null actionIcon by default', () => {
    expect(component.actionIcon()).toBeNull();
  });

  it('should display the default icon', () => {
    const icon = fixture.debugElement.query(By.css('.placeholder-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('home_work');
  });

  it('should display the default title', () => {
    const title = fixture.debugElement.query(By.css('h2'));
    expect(title.nativeElement.textContent.trim()).toBe('No items yet');
  });

  it('should display the default message', () => {
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent.trim()).toBe(
      'Add your first item to get started.'
    );
  });

  it('should not render action button when actionLabel is null', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeNull();
  });

  it('should not render action button when actionRoute is null', () => {
    fixture.componentRef.setInput('actionLabel', 'Add Item');
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeNull();
  });
});

describe('EmptyStateComponent with custom inputs', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('icon', 'work');
    fixture.componentRef.setInput('title', 'No Work Orders');
    fixture.componentRef.setInput('message', 'Create your first work order.');
    fixture.detectChanges();
  });

  it('should display custom icon', () => {
    const icon = fixture.debugElement.query(By.css('.placeholder-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('work');
  });

  it('should display custom title', () => {
    const title = fixture.debugElement.query(By.css('h2'));
    expect(title.nativeElement.textContent.trim()).toBe('No Work Orders');
  });

  it('should display custom message', () => {
    const message = fixture.debugElement.query(By.css('p'));
    expect(message.nativeElement.textContent.trim()).toBe(
      'Create your first work order.'
    );
  });
});

describe('EmptyStateComponent with action button', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('actionLabel', 'Add Property');
    fixture.componentRef.setInput('actionRoute', '/properties/new');
    fixture.detectChanges();
  });

  it('should render action button when both actionLabel and actionRoute are set', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).toBeTruthy();
  });

  it('should display action button with correct label', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button.nativeElement.textContent).toContain('Add Property');
  });

  it('should have actionRoute set correctly', () => {
    expect(fixture.componentInstance.actionRoute()).toBe('/properties/new');
  });

  it('should not display action icon when not provided', () => {
    const buttonIcon = fixture.debugElement.query(By.css('button mat-icon'));
    expect(buttonIcon).toBeNull();
  });
});

describe('EmptyStateComponent with action button and icon', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('actionLabel', 'Add Property');
    fixture.componentRef.setInput('actionRoute', '/properties/new');
    fixture.componentRef.setInput('actionIcon', 'add');
    fixture.detectChanges();
  });

  it('should display action icon in button when provided', () => {
    const buttonIcon = fixture.debugElement.query(By.css('button mat-icon'));
    expect(buttonIcon).toBeTruthy();
    expect(buttonIcon.nativeElement.textContent.trim()).toBe('add');
  });
});
