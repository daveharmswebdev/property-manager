import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { SettingsComponent } from './settings.component';

/**
 * Unit tests for SettingsComponent (AC7.7)
 *
 * Test coverage:
 * - Component creation
 * - Placeholder UI display
 */
describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render placeholder container', () => {
    const container = fixture.debugElement.query(By.css('.placeholder-container'));
    expect(container).toBeTruthy();
  });

  it('should render placeholder card', () => {
    const card = fixture.debugElement.query(By.css('.placeholder-card'));
    expect(card).toBeTruthy();
  });

  it('should display settings icon', () => {
    const icon = fixture.debugElement.query(By.css('.placeholder-icon'));
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent.trim()).toBe('settings');
  });

  it('should display "Settings" title', () => {
    const title = fixture.debugElement.query(By.css('h2'));
    expect(title).toBeTruthy();
    expect(title.nativeElement.textContent.trim()).toBe('Settings');
  });

  it('should display "coming soon" message', () => {
    const paragraphs = fixture.debugElement.queryAll(By.css('p'));
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    const messages = paragraphs.map(p => p.nativeElement.textContent);
    expect(messages.some(m => m.includes('coming soon'))).toBe(true);
  });

  it('should display hint about future release', () => {
    const hint = fixture.debugElement.query(By.css('.hint'));
    expect(hint).toBeTruthy();
    expect(hint.nativeElement.textContent).toContain('future release');
  });
});
