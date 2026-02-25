import { extractDigits, formatPhoneDisplay, formatPhoneInput } from './phone-format.utils';

describe('phone-format.utils', () => {
  describe('extractDigits', () => {
    it('should return empty for empty string', () => {
      expect(extractDigits('')).toBe('');
    });

    it('should strip non-digit characters', () => {
      expect(extractDigits('(512) 555-1234')).toBe('5125551234');
    });

    it('should limit to 10 digits', () => {
      expect(extractDigits('512555123456789')).toBe('5125551234');
    });

    it('should handle digits-only input', () => {
      expect(extractDigits('5125551234')).toBe('5125551234');
    });
  });

  describe('formatPhoneDisplay', () => {
    it('should return empty for empty string', () => {
      expect(formatPhoneDisplay('')).toBe('');
    });

    it('should format 1-3 digits without trailing space', () => {
      expect(formatPhoneDisplay('5')).toBe('(5)');
      expect(formatPhoneDisplay('51')).toBe('(51)');
      expect(formatPhoneDisplay('512')).toBe('(512)');
    });

    it('should format 4-6 digits without trailing dash', () => {
      expect(formatPhoneDisplay('5125')).toBe('(512) 5');
      expect(formatPhoneDisplay('512555')).toBe('(512) 555');
    });

    it('should format 7-10 digits fully', () => {
      expect(formatPhoneDisplay('5125551')).toBe('(512) 555-1');
      expect(formatPhoneDisplay('5125551234')).toBe('(512) 555-1234');
    });
  });

  describe('formatPhoneInput', () => {
    it('should return empty for empty string', () => {
      expect(formatPhoneInput('')).toBe('');
    });

    it('should format 1-3 digits with trailing space', () => {
      expect(formatPhoneInput('5')).toBe('(5) ');
      expect(formatPhoneInput('51')).toBe('(51) ');
      expect(formatPhoneInput('512')).toBe('(512) ');
    });

    it('should format 4-6 digits with trailing dash', () => {
      expect(formatPhoneInput('5125')).toBe('(512) 5-');
      expect(formatPhoneInput('512555')).toBe('(512) 555-');
    });

    it('should format 7-10 digits fully (same as display)', () => {
      expect(formatPhoneInput('5125551')).toBe('(512) 555-1');
      expect(formatPhoneInput('5125551234')).toBe('(512) 555-1234');
    });
  });
});
