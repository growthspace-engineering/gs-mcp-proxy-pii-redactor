import { Matcher } from './matcher';

describe('Matcher', () => {
  describe('build', () => {
    it('should create a matcher with valid dictionary', async () => {
      const dictionary = ['john', 'jane', 'doe'];
      const matcher = await Matcher.build(dictionary);
      expect(matcher).toBeDefined();
    });

    it('should throw error with empty dictionary', async () => {
      await expect(Matcher.build([])).rejects.toThrow('Empty dictionary for matcher');
    });
  });

  describe('redact', () => {
    it('should redact a single matching term', async () => {
      const dictionary = ['secret'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('This is a secret message');
      expect(result).toBe('This is a [REDACTED] message');
    });

    it('should redact multiple matching terms', async () => {
      const dictionary = ['john', 'jane'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('john and jane are here');
      expect(result).toBe('[REDACTED] and [REDACTED] are here');
    });

    it('should perform case-insensitive matching', async () => {
      const dictionary = ['secret'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact('SECRET message')).toBe('[REDACTED] message');
      expect(matcher.redact('Secret message')).toBe('[REDACTED] message');
      expect(matcher.redact('secret message')).toBe('[REDACTED] message');
      expect(matcher.redact('SeCrEt message')).toBe('[REDACTED] message');
    });

    it('should match whole words only', async () => {
      const dictionary = ['cat'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact('The cat is here')).toBe('The [REDACTED] is here');
      expect(matcher.redact('catalog')).toBe('catalog'); // Should not match
      expect(matcher.redact('bobcat')).toBe('bobcat'); // Should not match
      expect(matcher.redact('scat')).toBe('scat'); // Should not match
    });

    it('should handle word boundaries correctly with punctuation', async () => {
      const dictionary = ['test'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact('test.')).toBe('[REDACTED].');
      expect(matcher.redact('test,')).toBe('[REDACTED],');
      expect(matcher.redact('test!')).toBe('[REDACTED]!');
      expect(matcher.redact('test?')).toBe('[REDACTED]?');
      expect(matcher.redact('(test)')).toBe('([REDACTED])');
      expect(matcher.redact('"test"')).toBe('"[REDACTED]"');
    });

    it('should handle word boundaries with hyphens and spaces', async () => {
      const dictionary = ['name'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact('first-name')).toBe('first-[REDACTED]');
      expect(matcher.redact('name-suffix')).toBe('[REDACTED]-suffix');
      expect(matcher.redact('my name here')).toBe('my [REDACTED] here');
    });

    it('should redact multiple occurrences of same term', async () => {
      const dictionary = ['test'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('test test test');
      expect(result).toBe('[REDACTED] [REDACTED] [REDACTED]');
    });

    it('should handle overlapping matches by merging intervals', async () => {
      const dictionary = ['john doe', 'doe'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('john doe is here');
      expect(result).toBe('[REDACTED] is here');
    });

    it('should return original text if no matches found', async () => {
      const dictionary = ['secret'];
      const matcher = await Matcher.build(dictionary);
      const input = 'This is a normal message';
      const result = matcher.redact(input);
      expect(result).toBe(input);
    });

    it('should handle empty string', async () => {
      const dictionary = ['test'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('');
      expect(result).toBe('');
    });

    it('should handle text with only the matching term', async () => {
      const dictionary = ['secret'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('secret');
      expect(result).toBe('[REDACTED]');
    });

    it('should handle text starting with matching term', async () => {
      const dictionary = ['start'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('start of the message');
      expect(result).toBe('[REDACTED] of the message');
    });

    it('should handle text ending with matching term', async () => {
      const dictionary = ['end'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('message at the end');
      expect(result).toBe('message at the [REDACTED]');
    });

    it('should handle multi-word terms', async () => {
      const dictionary = ['john smith', 'jane doe'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('john smith and jane doe are here');
      expect(result).toBe('[REDACTED] and [REDACTED] are here');
    });

    it('should handle terms with special characters', async () => {
      const dictionary = ["o'brien", 'test-user'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact("Mr. o'brien is here")).toBe('Mr. [REDACTED] is here');
      expect(matcher.redact('User test-user logged in')).toBe('User [REDACTED] logged in');
    });

    it('should merge adjacent matches', async () => {
      const dictionary = ['abc', 'def'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('abc def');
      expect(result).toBe('[REDACTED] [REDACTED]');
    });

    it('should handle large dictionary efficiently', async () => {
      const dictionary = Array.from({ length: 1000 }, (_, i) => `term${i}`);
      const matcher = await Matcher.build(dictionary);
      
      const result = matcher.redact('This contains term500 and term999');
      expect(result).toBe('This contains [REDACTED] and [REDACTED]');
    });

    it('should handle long text efficiently', async () => {
      const dictionary = ['secret'];
      const matcher = await Matcher.build(dictionary);
      
      const longText = 'word '.repeat(1000) + 'secret ' + 'word '.repeat(1000);
      const result = matcher.redact(longText);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('secret');
    });

    it('should handle text with numbers and underscores as word boundaries', async () => {
      const dictionary = ['user'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact('user_name')).toBe('user_name'); // underscore is part of word
      expect(matcher.redact('user123')).toBe('user123'); // number is part of word
      expect(matcher.redact('the user 123')).toBe('the [REDACTED] 123'); // space separates
    });

    it('should handle consecutive terms with different cases', async () => {
      const dictionary = ['test'];
      const matcher = await Matcher.build(dictionary);
      const result = matcher.redact('TEST test TeSt');
      expect(result).toBe('[REDACTED] [REDACTED] [REDACTED]');
    });

    it('should not match partial words in compound words', async () => {
      const dictionary = ['work'];
      const matcher = await Matcher.build(dictionary);
      
      expect(matcher.redact('homework')).toBe('homework');
      expect(matcher.redact('eworker')).toBe('eworker');
      expect(matcher.redact('my work here')).toBe('my [REDACTED] here');
    });
  });
});

