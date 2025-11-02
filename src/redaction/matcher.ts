// Simple Aho-Corasick implementation for matching
// Since we need case-insensitive and whole-word matching, we'll implement a simpler version
// or use a library that supports these features

interface IMatch {
  start: number;
  end: number;
}
type Match = IMatch;

export class Matcher {
  private patterns: string[];
  private lowerPatterns: string[];

  private constructor(dictionary: string[]) {
    this.patterns = dictionary;
    this.lowerPatterns = dictionary.map((p) => p.toLowerCase());
  }

  static async build(dictionary: string[]): Promise<Matcher> {
    if (dictionary.length === 0) {
      throw new Error('Empty dictionary for matcher');
    }
    return new Matcher(dictionary);
  }

  redact(text: string): string {
    const matches = this.findAllMatches(text);
    if (matches.length === 0) {
      return text;
    }

    // Sort matches by start position
    const sortedMatches = matches.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const merged: Match[] = [];
    for (const match of sortedMatches) {
      if (merged.length === 0 || match.start > merged[merged.length - 1].end) {
        merged.push(match);
      } else {
        const last = merged[merged.length - 1];
        if (match.end > last.end) {
          last.end = match.end;
        }
      }
    }

    // Build redacted string
    let result = '';
    let prev = 0;
    for (const match of merged) {
      if (match.start > prev) {
        result += text.substring(prev, match.start);
      }
      result += '[REDACTED]';
      prev = match.end;
    }
    if (prev < text.length) {
      result += text.substring(prev);
    }

    return result;
  }

  private findAllMatches(text: string): Match[] {
    const matches: Match[] = [];
    const lowerText = text.toLowerCase();

    for (let i = 0; i < this.lowerPatterns.length; i++) {
      const pattern = this.lowerPatterns[i];
      let searchIndex = 0;

      while (true) {
        const index = lowerText.indexOf(pattern, searchIndex);
        if (index === -1) {
          break;
        }

        // Check if it's a whole word match
        const start = index;
        const end = index + pattern.length;
        if (this.isWholeWord(text, start, end)) {
          matches.push({ start, end });
        }

        searchIndex = index + 1;
      }
    }

    return matches;
  }

  private isWholeWord(text: string, start: number, end: number): boolean {
    // Check character before match
    if (start > 0) {
      const charBefore = text[start - 1];
      if (this.isWordChar(charBefore)) {
        return false;
      }
    }

    // Check character after match
    if (end < text.length) {
      const charAfter = text[end];
      if (this.isWordChar(charAfter)) {
        return false;
      }
    }

    return true;
  }

  private isWordChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }
}

