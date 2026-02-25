import { PhoneFormatPipe } from './phone-format.pipe';

describe('PhoneFormatPipe', () => {
  let pipe: PhoneFormatPipe;

  beforeEach(() => {
    pipe = new PhoneFormatPipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should format 10-digit string', () => {
    expect(pipe.transform('5125551234')).toBe('(512) 555-1234');
  });

  it('should handle null/undefined/empty', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('should strip non-digits before formatting', () => {
    expect(pipe.transform('512-555-1234')).toBe('(512) 555-1234');
    expect(pipe.transform('(512) 555-1234')).toBe('(512) 555-1234');
  });

  it('should handle partial numbers', () => {
    expect(pipe.transform('512')).toBe('(512)');
    expect(pipe.transform('512555')).toBe('(512) 555');
    expect(pipe.transform('5125551')).toBe('(512) 555-1');
  });
});
