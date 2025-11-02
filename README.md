# MCP Proxy with PII Redaction - TypeScript/NestJS Implementation

[![Beta Combined Coverage](https://img.shields.io/endpoint?url=https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/beta/combined-coverage/badge.json&label=beta%20coverage)](https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/beta/combined-coverage/)
[![Main Combined Coverage](https://img.shields.io/endpoint?url=https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/main/combined-coverage/badge.json&label=main%20coverage)](https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/main/combined-coverage/)

> TypeScript/NestJS implementation of the MCP Proxy with PII Redaction, compatible with the Go implementation's `config.json` format.

## Overview

This is a TypeScript/NestJS reimplementation of the `redact-mcp-proxy` project. It provides the same functionality:

- ✅ Proxy multiple MCP servers through a single HTTP endpoint
- ✅ Support for stdio, SSE, and streamable-http transports
- ✅ PII redaction with GCS-backed dictionary
- ✅ Tool filtering (allow/block lists)
- ✅ Authentication middleware
- ✅ Audit logging
- ✅ Compatible `config.json` format

## Installation

```bash
npm install
```

## Configuration

The project uses the same `config.json` format as the Go implementation:

```json
{
  "mcpProxy": {
    "baseURL": "http://localhost:8083",
    "addr": ":8083",
    "name": "MCP Proxy with PII Redaction",
    "version": "1.0.0",
    "type": "streamable-http",
    "options": {
      "panicIfInvalid": false,
      "logEnabled": true
    }
  },
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "mcp-remote@0.1.17", "https://mcp.atlassian.com/v1/sse"],
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

## Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# With custom config
npm run start:prod -- --config /path/to/config.json
```

## Environment Variables

- `MCP_PROXY_GCS_BUCKET`: GCS bucket name containing PII dictionary files (required)
- `MCP_PROXY_GCS_FILES`: Comma-separated list of file names in the bucket (default: `names.txt,emails.txt`)
- `MCP_PROXY_SERVICE_ACCOUNT`: GCS service account JSON (for PII redaction)
- `MCP_PROXY_SERVICE_ACCOUNT_B64`: Base64-encoded service account JSON

## Features

### PII Redaction

Per-MCP redaction configuration in `config.json`:

```json
{
  "mcpServers": {
    "example": {
      "options": {
        "redaction": {
          "enabled": true,
          "keys": ["description", "text"],
          "verboseAudit": false
        }
      }
    }
  }
}
```

### Tool Filtering

```json
{
  "mcpServers": {
    "example": {
      "options": {
        "toolFilter": {
          "mode": "block",
          "list": ["dangerous_tool", "another_tool"]
        }
      }
    }
  }
}
```

## Development Status

⚠️ **Note**: This is a work in progress. The MCP SDK integration needs to be completed based on the actual `@modelcontextprotocol/sdk` API.

## Contributors

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

### How It Works

When you merge a pull request, our GitHub Actions workflow automatically:
- Adds the contributor to the `.all-contributorsrc` configuration
- Updates the Contributors section in this README
- Creates a commit with the changes

You can also manually add contributors using:
```bash
npm run contributors:add -- <username> <contribution-type>
```

Contribution types include: `code`, `doc`, `test`, `bug`, `ideas`, `review`, and [more](https://allcontributors.org/docs/en/emoji-key).

## License

MIT

