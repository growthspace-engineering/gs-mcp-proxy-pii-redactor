// Matcher that performs case-insensitive, whole-word redaction using
// an Aho–Corasick automaton for efficient multi-pattern search.

interface IMatch {
  start: number; // inclusive
  end: number;   // exclusive
}
type Match = IMatch;

export class Matcher {
  private lowerPatterns: string[];
  private ac: any | null;

  private constructor(dictionary: string[]) {
    // Normalize patterns once for case-insensitive matching
    const dedup = new Set<string>();
    for (const p of dictionary) {
      const lp = p.toLowerCase();
      if (lp.length > 0) {
        dedup.add(lp);
      }
    }
    this.lowerPatterns = Array.from(dedup);

    // Initialize Aho–Corasick if available; fallback handled in findAllMatches
    let AhoCtor: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      AhoCtor = require('ahocorasick');
    } catch {
      AhoCtor = null;
    }
    this.ac = AhoCtor ? new AhoCtor(this.lowerPatterns) : null;
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

    // Sort by start and merge overlapping/adjacent ranges
    matches.sort((a, b) => a.start - b.start);
    const merged: Match[] = [];
    for (const m of matches) {
      const last = merged[merged.length - 1];
      if (!last || m.start > last.end) {
        merged.push({ start: m.start, end: m.end });
      } else if (m.end > last.end) {
        last.end = m.end;
      }
    }

    // Build the redacted string
    let result = '';
    let cursor = 0;
    for (const m of merged) {
      if (m.start > cursor) {
        result += text.substring(cursor, m.start);
      }
      result += '[REDACTED]';
      cursor = m.end;
    }
    if (cursor < text.length) {
      result += text.substring(cursor);
    }
    return result;
  }

  private findAllMatches(text: string): Match[] {
    const matches: Match[] = [];
    const lowerText = text.toLowerCase();

    if (this.ac) {
      // The ahocorasick package returns an array of results. Different versions expose
      // slightly different shapes. We handle common shapes conservatively.
      const results: any[] = this.ac.search(lowerText) || [];
      for (const r of results) {
        // Common shape: [endIndex, outputs[]]
        const endIdxRaw = Array.isArray(r) ? r[0] : (r?.index ?? r?.end ?? null);
        const outputs = Array.isArray(r) ? (r[1] || []) : (r?.outputs || r?.matches || r?.result || []);
        if (typeof endIdxRaw !== 'number' || !outputs || !Array.isArray(outputs)) {
          continue;
        }
        for (const w of outputs) {
          if (typeof w !== 'string' || w.length === 0) continue;
          const len = w.length;
          // Most implementations return end index (inclusive). Convert to [start, endExclusive]
          const endExclusive = endIdxRaw + 1;
          const start = endExclusive - len;
          const end = endExclusive;
          if (start >= 0 && end <= lowerText.length && this.isWholeWord(text, start, end)) {
            matches.push({ start, end });
          }
        }
      }
      return matches;
    }

    // Fallback: sequential indexOf search (still case-insensitive & whole-word)
    for (const pattern of this.lowerPatterns) {
      let searchIndex = 0;
      while (true) {
        const index = lowerText.indexOf(pattern, searchIndex);
        if (index === -1) break;
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
    if (start > 0) {
      const before = text[start - 1];
      if (this.isWordChar(before)) return false;
    }
    if (end < text.length) {
      const after = text[end];
      if (this.isWordChar(after)) return false;
    }
    return true;
  }

  private isWordChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }
}

