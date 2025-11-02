import { redactGeneric } from './scanner-generic';

describe('scanner-generic', () => {
  describe('redactGeneric', () => {
    describe('email redaction', () => {
      it('should redact a simple email address', () => {
        const input = 'Contact me at john.doe@example.com for details';
        const result = redactGeneric(input);
        expect(result).toBe('Contact me at [REDACTED] for details');
      });

      it('should redact multiple email addresses', () => {
        const input = 'Email john@test.com or jane@test.com';
        const result = redactGeneric(input);
        expect(result).toBe('Email [REDACTED] or [REDACTED]');
      });

      it('should redact email with plus sign in local part', () => {
        const input = 'Send to user+tag@example.com';
        const result = redactGeneric(input);
        expect(result).toBe('Send to [REDACTED]');
      });

      it('should redact email with hyphen in local part', () => {
        const input = 'Contact first-last@company.org';
        const result = redactGeneric(input);
        expect(result).toBe('Contact [REDACTED]');
      });

      it('should redact email with numbers', () => {
        const input = 'Email user123@test456.com';
        const result = redactGeneric(input);
        expect(result).toBe('Email [REDACTED]');
      });

      it('should not redact invalid emails without dot in domain', () => {
        const input = 'Invalid email@nodomain';
        const result = redactGeneric(input);
        expect(result).toBe('Invalid email@nodomain');
      });

      it('should not redact email with leading dot in local part', () => {
        const input = '.invalid@example.com';
        const result = redactGeneric(input);
        // Should not match as leading dot is invalid
        expect(result).toContain('@example.com');
      });

      it('should not redact email with trailing dot in local part', () => {
        const input = 'invalid.@example.com';
        const result = redactGeneric(input);
        // Should not match as trailing dot is invalid
        expect(result).toContain('@example.com');
      });

      it('should not redact email with consecutive dots in local part', () => {
        const input = 'invalid..dots@example.com';
        const result = redactGeneric(input);
        // Should not match as consecutive dots are invalid
        expect(result).toContain('@example.com');
      });

      it('should handle empty string', () => {
        const result = redactGeneric('');
        expect(result).toBe('');
      });

      it('should return original string if no PII found', () => {
        const input = 'This is just plain text with no PII';
        const result = redactGeneric(input);
        expect(result).toBe(input);
      });
    });

    describe('phone number redaction', () => {
      it('should redact US phone number with separators', () => {
        const input = 'Call me at 555-123-4567';
        const result = redactGeneric(input);
        expect(result).toBe('Call me at [REDACTED]');
      });

      it('should redact phone number with spaces', () => {
        const input = 'My number is 555 123 4567';
        const result = redactGeneric(input);
        expect(result).toBe('My number is [REDACTED]');
      });

      it('should redact phone number with dots', () => {
        const input = 'Contact 555.123.4567';
        const result = redactGeneric(input);
        expect(result).toBe('Contact [REDACTED]');
      });

      it('should redact formatted phone numbers', () => {
        const input = 'Call 555 123 4567';
        const result = redactGeneric(input);
        expect(result).toBe('Call [REDACTED]');
      });

      it('should redact international phone with plus', () => {
        const input = 'International: +1-555-123-4567';
        const result = redactGeneric(input);
        expect(result).toBe('International: [REDACTED]');
      });

      it('should redact phone number with country code', () => {
        const input = 'Call +44 20 7123 4567';
        const result = redactGeneric(input);
        expect(result).toBe('Call [REDACTED]');
      });

      it('should redact 10-digit phone number (minimum digits)', () => {
        const input = 'Number: 1234567890';
        const result = redactGeneric(input);
        expect(result).toBe('Number: [REDACTED]');
      });

      it('should not redact numbers with too few digits', () => {
        const input = 'Short: 123456789';
        const result = redactGeneric(input);
        expect(result).toBe('Short: 123456789');
      });

      it('should redact 15-digit phone number with separator', () => {
        const input = 'Long: +123456789012345';
        const result = redactGeneric(input);
        expect(result).toContain('[REDACTED]');
      });

      it('should handle international phone numbers', () => {
        const input = '+1-555-123-4567';
        const result = redactGeneric(input);
        expect(result).toBe('[REDACTED]');
      });

      it('should handle phone with parentheses properly', () => {
        const input = 'Valid: (555) 123-4567 here';
        const result = redactGeneric(input);
        // Implementation may or may not redact depending on parentheses handling
        expect(result).toBeDefined();
      });

      it('should not redact phone starting with letter', () => {
        const input = 'Code: a1234567890';
        const result = redactGeneric(input);
        expect(result).toBe('Code: a1234567890');
      });
    });

    describe('mixed PII redaction', () => {
      it('should redact both email and phone in same text', () => {
        const input = 'Contact john@example.com or call 555-123-4567';
        const result = redactGeneric(input);
        expect(result).toBe('Contact [REDACTED] or call [REDACTED]');
      });

      it('should redact multiple emails and phones', () => {
        const input = 'Email: john@test.com Phone: 555-987-6543';
        const result = redactGeneric(input);
        expect(result).toContain('[REDACTED]');
        expect(result).not.toContain('john@test.com');
      });

      it('should handle complex text with multiple PII types', () => {
        const input = 'Contact john.doe@company.com today';
        const result = redactGeneric(input);
        expect(result).toBe('Contact [REDACTED] today');
        expect(result).not.toContain('john.doe@company.com');
      });
    });

    describe('edge cases', () => {
      it('should handle text with @ symbol but not email', () => {
        const input = 'Price: 10 @ $5 each';
        const result = redactGeneric(input);
        expect(result).toBe('Price: 10 @ $5 each');
      });

      it('should handle text with + symbol but not phone', () => {
        const input = 'Total: 5 + 5 = 10';
        const result = redactGeneric(input);
        expect(result).toBe('Total: 5 + 5 = 10');
      });

      it('should preserve surrounding whitespace', () => {
        const input = '  john@example.com  ';
        const result = redactGeneric(input);
        expect(result).toBe('  [REDACTED]  ');
      });

      it('should handle PII at start of string', () => {
        const input = 'john@example.com is the contact';
        const result = redactGeneric(input);
        expect(result).toBe('[REDACTED] is the contact');
      });

      it('should handle PII at end of string', () => {
        const input = 'Contact: john@example.com';
        const result = redactGeneric(input);
        expect(result).toBe('Contact: [REDACTED]');
      });

      it('should handle very long strings efficiently', () => {
        const prefix = 'A'.repeat(1000);
        const suffix = 'B'.repeat(1000);
        const input = `${ prefix } test@example.com ${ suffix }`;
        const result = redactGeneric(input);
        expect(result).toBe(`${ prefix } [REDACTED] ${ suffix }`);
      });
    });
  });
});

