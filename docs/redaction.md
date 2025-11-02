# PII Redaction

## Overview

This proxy includes built-in PII redaction capabilities that can automatically redact sensitive information from MCP server responses. Redaction uses a combination of dictionary-based matching and generic pattern detection.

## Environment Variables

PII redaction requires Google Cloud Storage (GCS) configuration:

```bash
# Required: GCS bucket name containing PII dictionary files
export MCP_PROXY_GCS_BUCKET=your-bucket-name

# Optional: Comma-separated list of file names in the bucket (default: names.txt,emails.txt)
export MCP_PROXY_GCS_FILES=names.txt,emails.txt,custom.txt

# Required: GCS service account JSON (one of the following)
export MCP_PROXY_SERVICE_ACCOUNT='{"type":"service_account",...}'
# OR base64-encoded:
export MCP_PROXY_SERVICE_ACCOUNT_B64=base64encodedjson
```

## Redaction Configuration

### Redact Specific Keys

Redact PII only in specified JSON keys:

```json
{
  "mcpServers": {
    "atlassian": {
      "options": {
        "redaction": {
          "enabled": true,
          "keys": ["description", "text", "href"]
        }
      }
    }
  }
}
```

When `keys` is specified, only those JSON keys are redacted. The redaction process recursively traverses nested objects and arrays within those keys.

### Redact All Strings

If `keys` is omitted or empty, all strings in the response are redacted:

```json
{
  "mcpServers": {
    "example": {
      "options": {
        "redaction": {
          "enabled": true
        }
      }
    }
  }
}
```

This mode redacts all string values found anywhere in the response payload.

## Redaction Features

### Dictionary-Based Matching

- Matches terms from GCS dictionary files (case-insensitive, whole-word matching)
- Dictionary files are loaded at startup and combined into a single matcher
- Terms are matched as whole words only (not substrings)

### Generic Pattern Matching

Automatically redacts:
- **Email addresses**: Standard email format detection
- **Phone numbers**: International phone number formats (10-15 digits)

Generic patterns are applied before dictionary matching.

### Nested Traversal

The redaction process recursively processes:
- Nested objects
- Arrays
- Mixed data structures

### Audit Logging

Optional verbose audit logging for debugging:

```json
{
  "redaction": {
    "enabled": true,
    "keys": ["description"],
    "verboseAudit": true
  }
}
```

When enabled, audit logs show original and redacted values for debugging purposes.

## Limitations

- Upstream headers are only supported for `streamable-http` transport type
- Redaction configuration is not inherited from `mcpProxy.options` (must be set per-server)
- Dictionary files must be accessible from GCS at startup
- If GCS initialization fails and redaction is enabled, the server will fail to start

## How It Works

1. **Initialization**: On startup, if any server has redaction enabled, the service loads dictionary files from GCS
2. **Request Processing**: When a tool/prompt/resource response is received:
   - Generic patterns (emails, phones) are redacted first
   - Dictionary terms are matched and redacted
   - If `keys` is specified, only those keys are processed
   - If `keys` is empty, all strings are processed
3. **Redaction**: Matched content is replaced with `[REDACTED]`

