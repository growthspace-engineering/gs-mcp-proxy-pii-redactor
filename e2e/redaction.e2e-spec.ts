/* eslint-disable */
import { RedactionService } from '../src/redaction/redaction.service';
import { Matcher } from '../src/redaction/matcher';

describe('PII Redaction (e2e-like service tests)', () => {
  let service: RedactionService;

  beforeAll(async () => {
    service = new RedactionService();
    // Seed matcher with a deterministic dictionary to avoid GCS dependency
    const dictionary = ['Romario', 'GaryPratt', 'Chieh'];
    const matcher = await Matcher.build(dictionary);
    (service as any).matcher = matcher;
    (service as any).initialized = true;
  });

  it('uses Aho–Corasick automaton when available', async () => {
    const m = await Matcher.build(['alpha', 'beta']);
    expect(typeof (m as any).isAutomatonEnabled).toBe('function');
    expect(m.isAutomatonEnabled()).toBe(true);
  });

  it('redacts emails and phone numbers generically in plain strings', () => {
    const input =
      'Email me at foo.bar+test@example.com or at user@example.co.uk, call +1 (650) 555-1234 or +972 52-353-1234.';
    const output = (service as any).redactAllStrings
      ? (service as any).redactAllStrings(input)
      : service['redactAllStrings'](input);
    expect(output).toMatchSnapshot();
  });

  it('redacts by configured keys (and recursively traversed strings) using keys [description, text, href]', () => {
    const payload = {
      summary: 'Case for Romario',
      description:
        'Email: foo.bar+test@example.com, Phone: +1 (650) 555-1234. Hello Romario and GaryPratt. abc123456123 should not be redacted.',
      text: 'Contact at user@example.co.uk and +972 52-353-1234 and Chieh',
      href: 'mailto:someone@example.com',
      other:
        'This other field has user@example.com and +1-212-555-0987 but may be affected by traversal.',
      nested: {
        note: 'Romario is in nested note with email a.b@example.com',
      },
      list: [
        'GaryPratt appears here',
        { inner: 'Call me at +44 20 7946 0958' },
        'no pii',
      ],
    };

    const redacted = service.redactResponse(payload, {
      enabled: true,
      keys: ['description', 'text', 'href'],
      verboseAudit: false,
    });

    expect(redacted).toMatchSnapshot();
  });

  it('when no keys are configured, redacts all strings', () => {
    const payload = {
      title: 'Hello Romario',
      body: 'Email: x@y.z, phone: +1-202-555-0199, and Chieh mentioned.',
      meta: { href: 'mailto:test@example.com', text: 'GaryPratt present' },
    };

    const redacted = service.redactResponse(payload, {
      enabled: true,
      // keys omitted → redact all strings
    });

    expect(redacted).toMatchSnapshot();
  });

  it('returns original data when redaction disabled', () => {
    const payload = {
      text: 'Romario user@example.com +1-212-555-0987',
    };
    const redacted = service.redactResponse(payload, {
      enabled: false,
      keys: ['text'],
    });
    expect(redacted).toEqual(payload);
  });

  it('returns original data when matcher not initialized', async () => {
    const payload = {
      text: 'Romario user@example.com +1-212-555-0987',
    };
    const fresh = new RedactionService();
    // Do not set matcher/initialized → behaves as uninitialized service
    const redacted = fresh.redactResponse(payload, {
      enabled: true,
      keys: ['text'],
    });
    expect(redacted).toEqual(payload);
  });
});


