# Other IDEs (stdio, SSE, streamable HTTP)

Many IDEs/editors that support the Model Context Protocol (MCP) can run stdio servers by specifying a command and arguments. You can also connect over HTTP/SSE using `mcp-remote` if you run the proxy locally.

Use one of the following setups when adding this proxy:

## Option A: Use npx (no global install)

```json
{
  "command": "npx",
  "args": [
    "-y",
    "@growthspace-engineering/gs-mcp-proxy-pii-redactor",
    "--config",
    "~/gs-mcp-proxy/config.json",
    "--stdio-target",
    "github"
  ]
}
```

## Option B: Global install

```bash
npm i -g @growthspace-engineering/gs-mcp-proxy-pii-redactor
```

```json
{
  "command": "gs-mcp-proxy",
  "args": [
    "--config",
    "~/nice/config.json",
    "--stdio-target",
    "github"
  ]
}
```

Notes:
- Replace `github` with the downstream key you want (e.g., `atlassian`).
- Provide any required tokens via your IDE's environment mechanism (often an `env` block alongside `command`/`args`).
- Check your IDE's MCP or tool integration settings for where to register stdio servers.

## Alternative: Connect via SSE/HTTP (requires local server)

1) Install and run the proxy locally:

```bash
npm i -g @growthspace-engineering/gs-mcp-proxy-pii-redactor
gs-mcp-proxy --config ~/gs-mcp-proxy/config.json
```

Ensure your `config.json` has a `baseURL` such as `http://localhost:8084`.

2) Configure your IDE to use `mcp-remote`:

```json
{
  "command": "npx",
  "args": ["mcp-remote", "http://localhost:8084/github/sse"]
}
```

or streamable HTTP:

```json
{
  "command": "npx",
  "args": ["mcp-remote", "http://localhost:8084/github"]
}
```

Examples for specific IDEs:
- Cursor: see `docs/ide/cursor.md`.
- Claude Desktop: see `docs/ide/claude.md`.
- VS Code and others: follow the same stdio pattern above where your extension/tooling supports MCP servers.

