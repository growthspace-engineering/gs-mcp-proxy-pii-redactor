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
<a href="#contributors-"><img src="https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square" alt="All Contributors"></a>
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

- [Configuration](docs/configuration.md) - Configuration reference and examples
- [Usage](docs/usage.md) - CLI options, endpoints, authentication, and tool filtering
- [PII Redaction](docs/redaction.md) - Redaction setup and configuration
- [Deployment](docs/deployment.md) - Docker and production deployment

## Quick Start

### Prerequisites

- Node.js >= 22.14.0
- npm

### Installation

```bash
git clone https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor.git
cd gs-mcp-pii-redactor
npm install
```

### Running

```bash
# Development mode with watch
npm run start:dev

# Production build
npm run build
npm run start:prod

# With custom config file
npm run start:prod -- --config /path/to/config.json

# With remote config URL
npm run start:prod -- --config https://example.com/config.json

# Stdio server mode (serve one downstream over stdio)
# Select the downstream with --stdio-target when multiple are configured
npm run build
npm run start:stdio -- --stdio-target github-allow
```

### Minimal Configuration

```json
{
  "mcpProxy": {
    "baseURL": "http://localhost:8083",
    "addr": ":8083",
    "name": "MCP Proxy with PII Redaction",
    "version": "1.0.0",
    "type": "streamable-http"
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
      <td align="center" valign="top" width="14.28%"><a href="http://thatkookooguy.kibibit.io/"><img src="https://avatars.githubusercontent.com/u/10427304?v=4?s=100" width="100px;" alt="Neil Kalman"/><br /><sub><b>Neil Kalman</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/commits?author=thatkookooguy" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Romarionijim"><img src="https://github.com/Romarionijim.png?s=100" width="100px;" alt="Romario Nijim"/><br /><sub><b>Romario Nijim</b></sub></a><br /><a href="#ideas-Romarionijim" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-Romarionijim" title="Maintenance">🚧</a> <a href="#research-Romarionijim" title="Research">🔬</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apps/allcontributors"><img src="https://avatars.githubusercontent.com/in/23186?v=4?s=100" width="100px;" alt="allcontributors[bot]"/><br /><sub><b>allcontributors[bot]</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/commits?author=allcontributors[bot]" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://shaieliyahu.com"><img src="https://avatars.githubusercontent.com/u/74975334?v=4?s=100" width="100px;" alt="shai eliyahu"/><br /><sub><b>shai eliyahu</b></sub></a><br /><a href="https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/pulls?q=is%3Apr+reviewed-by%3Aaheua10" title="Reviewed Pull Requests">👀</a></td>
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
npm run contributors:add -- <username> <contribution-type>
```

Contribution types include: `code`, `doc`, `test`, `bug`, `ideas`, `review`, and [more](https://allcontributors.org/docs/en/emoji-key).

## Acknowledgments

- This project was inspired by the [TBXark/mcp-proxy](https://github.com/TBXark/mcp-proxy) project, a Go-based MCP proxy server that aggregates multiple MCP servers through a single HTTP endpoint.

## License

MIT
