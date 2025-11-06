<p align="center">
  <a href="https://github.com/growthspace-engineering" target="blank"><img src="GS-logo.svg" width="250" alt="GrowthSpace Logo" />
  </a>
  <h2 align="center">
    @growthspace-engineering/gs-mcp-proxy-pii-redactor
  </h2>
</p>
<p align="center">
  <a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/releases">
  <img src="https://img.shields.io/github/v/release/growthspace-engineering/gs-mcp-proxy-pii-redactor?display_name=tag&label=latest&logo=npm&color=CB3837&style=for-the-badge">
</a>
</p>
<p align="center">
<a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/tags">
  <img src="https://img.shields.io/github/v/tag/growthspace-engineering/gs-mcp-proxy-pii-redactor?filter=*-beta*&label=beta&logo=npm&color=CB3837&style=flat-square">
</a>
<!-- <a href="https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/main/combined-coverage/">
  <img src="https://img.shields.io/endpoint?url=https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/main/combined-coverage/badge.json&label=main%20coverage&style=flat-square">
</a> -->
<a href="https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/beta/combined-coverage/">
  <img src="https://img.shields.io/endpoint?url=https://growthspace-engineering.github.io/gs-mcp-proxy-pii-redactor/tests/branch/beta/combined-coverage/badge.json&label=coverage&style=flat-square">
</a>
<a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg"></a>
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all_contributors-6-orange.svg?style=flat-square" alt="All Contributors"></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>
<p align="center">
MCP Proxy with PII Redaction
</p>
<hr>

An MCP proxy that aggregates multiple MCP servers behind a single HTTP entrypoint, with built-in PII redaction capabilities.

## Features

- **Proxy multiple MCP servers**: Aggregate tools, prompts, and resources from many servers through a single HTTP endpoint
- **Multiple transport types**: Support for `stdio`, `sse`, and `streamable-http` client transports
- **Server transport options**: Serve via Server-Sent Events (SSE) or streamable HTTP
- **PII redaction**: Automatic redaction of PII using GCS-backed dictionaries and generic pattern matching
- **Tool filtering**: Allow or block specific tools per server configuration
- **Authentication**: Bearer token authentication with per-server or global configuration
- **Audit logging**: Optional verbose audit logging for redaction operations
- **Flexible configuration**: JSON configuration with environment variable interpolation

## Documentation

- [IDE setup](docs/ide/README.md)
  - [Cursor](docs/ide/cursor.md)
  - [Claude Desktop](docs/ide/claude.md)
  - [Other IDEs](docs/ide/other.md)
- [Configuration](docs/configuration.md) - Configuration reference and examples
- [Usage](docs/usage.md) - CLI options, endpoints, authentication, and tool filtering
- [PII Redaction](docs/redaction.md) - Redaction setup and configuration
- [Deployment](docs/deployment.md) - Docker and production deployment

## Quick Start

### Prerequisites

- Node.js >= 20 (or equivalent bun or pnpm)

### Option 1 — Run with stdio (recommended)

Integrate directly with your IDE over stdio. No global install required.

Before configuring your IDE, initialize a default config file (creates `~/gs-mcp-proxy/config.json` by default):
```bash
gs-mcp-proxy --init
# or without installing globally
npx -y @growthspace-engineering/gs-mcp-proxy-pii-redactor --init
```
See [Usage](docs/usage.md) to customize the destination via `--init-dest`.

- Cursor: see [docs/ide/cursor.md](docs/ide/cursor.md) (stdio section)
- Claude Desktop: see [docs/ide/claude.md](docs/ide/claude.md) (stdio section)
- Other IDEs: see [docs/ide/other.md](docs/ide/other.md)

### Option 2 — Run locally before IDE integration (SSE/HTTP)

1. Install the module globally:
   ```bash
   npm install -g @growthspace-engineering/gs-mcp-proxy-pii-redactor
   ```
2. Initialize a default config file (creates `~/gs-mcp-proxy/config.json` by default):
   ```bash
   gs-mcp-proxy --init
   ```
   See [Usage](docs/usage.md) to customize the destination via `--init-dest`.
3. Run the CLI (with or without a config file):
   ```bash
   gs-mcp-proxy --config ~/gs-mcp-proxy/config.json
   # or (uses ./config.json by default if present)
   gs-mcp-proxy
   ```
4. Connect your IDE using `mcp-remote` (SSE or streamable HTTP):
   - Cursor: see [docs/ide/cursor.md](docs/ide/cursor.md) (SSE/HTTP sections)
   - Claude Desktop: see [docs/ide/claude.md](docs/ide/claude.md) (SSE/HTTP sections)

Developer setup (clone, build, run locally) has moved to [CONTRIBUTING.md](CONTRIBUTING.md).

### Minimal Configuration (for local server)

```json
{
  "mcpProxy": {
    "baseURL": "http://localhost:8084",
    "addr": ":8084",
    "name": "MCP Proxy with PII Redaction",
    "version": "1.0.0",
    "type": "sse"
  },
  "mcpServers": {
    "github": {
      "transportType": "streamable-http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

See [Configuration](docs/configuration.md) for full configuration reference and examples.

## Testing

```bash
# Unit tests
npm test

# E2E tests (requires GITHUB_TOKEN)
export GITHUB_TOKEN=your_token_here
npm run test:e2e
```

**Note:** All E2E tests require a valid `GITHUB_TOKEN` environment variable. The test suite validates both SSE and Streamable HTTP transport options.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## Code of Conduct

This project adheres to a Code of Conduct. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://thatkookooguy.kibibit.io/"><img src="https://avatars.githubusercontent.com/u/10427304?v=4?s=100" width="100px;" alt="Neil Kalman"/><br /><sub><b>Neil Kalman</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/commits?author=thatkookooguy" title="Code">💻</a> <a href="#question-thatkookooguy" title="Answering Questions">💬</a> <a href="#blog-thatkookooguy" title="Blogposts">📝</a> <a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/commits?author=thatkookooguy" title="Documentation">📖</a> <a href="#ideas-thatkookooguy" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-thatkookooguy" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-thatkookooguy" title="Maintenance">🚧</a> <a href="#research-thatkookooguy" title="Research">🔬</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Romarionijim"><img src="https://github.com/Romarionijim.png?s=100" width="100px;" alt="Romario Nijim"/><br /><sub><b>Romario Nijim</b></sub></a><br /><a href="#ideas-Romarionijim" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-Romarionijim" title="Maintenance">🚧</a> <a href="#research-Romarionijim" title="Research">🔬</a> <a href="#question-Romarionijim" title="Answering Questions">💬</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://shaieliyahu.com"><img src="https://avatars.githubusercontent.com/u/74975334?v=4?s=100" width="100px;" alt="shai eliyahu"/><br /><sub><b>shai eliyahu</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/pulls?q=is%3Apr+reviewed-by%3Aaheua10" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.gla.co.il"><img src="https://avatars.githubusercontent.com/u/23203489?v=4?s=100" width="100px;" alt="Gal Amitai"/><br /><sub><b>Gal Amitai</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/pulls?q=is%3Apr+reviewed-by%3AGalAmitai" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yevgenim"><img src="https://avatars.githubusercontent.com/u/29144954?v=4?s=100" width="100px;" alt="Yevgeni Mumblat"/><br /><sub><b>Yevgeni Mumblat</b></sub></a><br /><a href="#ideas-yevgenim" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Utkarsh9571"><img src="https://avatars.githubusercontent.com/u/205407787?v=4?s=100" width="100px;" alt="Utkarsh9571"/><br /><sub><b>Utkarsh9571</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/commits?author=Utkarsh9571" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

### How It Works

When you merge a pull request, our GitHub Actions workflow automatically:
- Adds the contributor to the `.all-contributorsrc` configuration
- Updates the Contributors section in this README
- Creates a commit with the changes

You can also manually add contributors using:
```bash
npm run contributors:add
```
and the allcontributors cli will prompt you for the contribution details.

## Acknowledgments
This project was inspired by the following projects:
- [TBXark/mcp-proxy](https://github.com/TBXark/mcp-proxy): a Go-based MCP proxy server that aggregates multiple MCP servers through a single HTTP endpoint.
- [nestjs/nest](https://github.com/nestjs/nest): a progressive Node.js framework for building server-side applications.

## License

MIT 2025
