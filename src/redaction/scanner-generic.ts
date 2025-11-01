// Generic redaction for emails and phone numbers
// This performs a single linear scan to redact generic emails and phone numbers

const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;

export function redactGeneric(s: string): string {
  if (s.length === 0) {
    return s;
  }

  const result: string[] = [];
  let lastWrite = 0;
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    if (c === '@') {
      const emailResult = scanEmailAt(s, i);
      if (emailResult.valid) {
        if (emailResult.start > lastWrite) {
          result.push(s.substring(lastWrite, emailResult.start));
        }
        result.push('[REDACTED]');
        lastWrite = emailResult.end;
        i = emailResult.end;
        continue;
      }
    }

    if (c === '+' || isDigit(c)) {
      const phoneResult = scanPhoneAt(s, i, PHONE_MIN_DIGITS, PHONE_MAX_DIGITS);
      if (phoneResult.valid) {
        if (phoneResult.start > lastWrite) {
          result.push(s.substring(lastWrite, phoneResult.start));
        }
        result.push('[REDACTED]');
        lastWrite = phoneResult.end;
        i = phoneResult.end;
        continue;
      }
    }

    i++;
  }

  if (lastWrite === 0) {
    return s;
  }

  if (lastWrite < s.length) {
    result.push(s.substring(lastWrite));
  }

  return result.join('');
}

function scanEmailAt(s: string, idx: number): { start: number; end: number; valid: boolean } {
  const n = s.length;
  if (idx <= 0 || idx >= n - 1) {
    return { start: 0, end: 0, valid: false };
  }

  // Expand left for local-part
  let l = idx - 1;
  while (l >= 0 && isEmailLocalChar(s[l])) {
    l--;
  }
  const localStart = l + 1;
  const localEnd = idx;

  if (localStart >= localEnd) {
    return { start: 0, end: 0, valid: false };
  }

  // Basic local-part validity: no leading/trailing dot, no consecutive dots
  if (s[localStart] === '.' || s[localEnd - 1] === '.') {
    return { start: 0, end: 0, valid: false };
  }

  for (let i = localStart + 1; i < localEnd; i++) {
    if (s[i] === '.' && s[i - 1] === '.') {
      return { start: 0, end: 0, valid: false };
    }
  }

  // Expand right for domain
  let r = idx + 1;
  let labelLen = 0;
  let hasDot = false;
  let lastDot = -1;

  while (r < n) {
    const ch = s[r];
    if (isDomainLabelChar(ch)) {
      labelLen++;
      r++;
      continue;
    }
    if (ch === '.') {
      if (labelLen === 0 || s[r - 1] === '-') {
        return { start: 0, end: 0, valid: false };
      }
      hasDot = true;
      lastDot = r;
      labelLen = 0;
      r++;
      continue;
    }
    break;
  }

  const domainEnd = r;
  if (labelLen === 0 || s[domainEnd - 1] === '-') {
    return { start: 0, end: 0, valid: false };
  }
  if (!hasDot) {
    return { start: 0, end: 0, valid: false };
  }

  if (lastDot < 0 || domainEnd - lastDot - 1 < 2 || domainEnd - lastDot - 1 > 24) {
    return { start: 0, end: 0, valid: false };
  }

  // Boundary checks
  if (localStart > 0 && isAlphaNumUnderscore(s[localStart - 1])) {
    return { start: 0, end: 0, valid: false };
  }
  if (domainEnd < n && isAlphaNumUnderscore(s[domainEnd])) {
    return { start: 0, end: 0, valid: false };
  }

  return { start: localStart, end: domainEnd, valid: true };
}

function scanPhoneAt(
  s: string,
  i: number,
  minDigits: number,
  maxDigits: number,
): { start: number; end: number; valid: boolean } {
  const n = s.length;
  const start = i;
  let j = i;
  let digitCount = 0;
  let seenPlus = false;
  let seenSeparator = false;
  let parenDepth = 0;

  if (s[j] === '+') {
    seenPlus = true;
    j++;
    if (j >= n) {
      return { start: 0, end: 0, valid: false };
    }
  }

  while (j < n) {
    const ch = s[j];
    if (isDigit(ch)) {
      digitCount++;
      j++;
    } else if (ch === ' ' || ch === '-' || ch === '.') {
      seenSeparator = true;
      j++;
    } else if (ch === '(') {
      parenDepth++;
      seenSeparator = true;
      j++;
    } else if (ch === ')') {
      if (parenDepth === 0) {
        return { start: 0, end: 0, valid: false };
      }
      parenDepth--;
      j++;
    } else if (ch === 'x' || ch === 'X') {
      if (digitCount >= minDigits) {
        break;
      }
      break;
    } else {
      break;
    }
  }

  const end = j;
  if (parenDepth !== 0) {
    return { start: 0, end: 0, valid: false };
  }
  if (digitCount < minDigits || digitCount > maxDigits) {
    return { start: 0, end: 0, valid: false };
  }

  if (start > 0 && isAlphaUnderscore(s[start - 1])) {
    return { start: 0, end: 0, valid: false };
  }
  if (end < n && isAlphaUnderscore(s[end])) {
    return { start: 0, end: 0, valid: false };
  }

  if (!seenSeparator && !seenPlus && digitCount >= 12) {
    if (!(start + 1 < n && s[start] === '0' && s[start + 1] === '0')) {
      return { start: 0, end: 0, valid: false };
    }
  }

  return { start, end, valid: true };
}

function isDigit(b: string): boolean {
  return b >= '0' && b <= '9';
}

function isLetter(b: string): boolean {
  return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z');
}

function isAlphaNum(b: string): boolean {
  return isLetter(b) || isDigit(b);
}

function isAlphaUnderscore(b: string): boolean {
  return isLetter(b) || b === '_';
}

function isAlphaNumUnderscore(b: string): boolean {
  return isAlphaNum(b) || b === '_';
}

function isEmailLocalChar(b: string): boolean {
  return b === '.' || b === '_' || b === '+' || b === '-' || isAlphaNum(b);
}

function isDomainLabelChar(b: string): boolean {
  return isAlphaNum(b) || b === '-';
}

