# Docker Usage

This guide shows how to run the proxy in Docker, configure ports, and override the configuration for your own MCP servers.

## Image

- Registry: `ghcr.io`
- Image: `ghcr.io/growthspace-engineering/gs-mcp-proxy-pii-redactor`
- Tags: `latest` (main), `beta` (beta branch), and semantic versions

## Default behavior

- The container listens on port `8084` by default (configurable via the config file).
- The container starts with: `node dist/main.js --config /app/config.docker.json`.
- Health endpoint: `GET /` returns `{ "status": "ok" }`.

Run it:

```bash
docker run -p 8084:8084 ghcr.io/growthspace-engineering/gs-mcp-proxy-pii-redactor:latest
```

## Override the configuration

You can provide your own config to define MCP servers, authentication, and transport type.

### Option 1 — Bind-mount over the default path (simple)

Mount your file as `/app/config.docker.json`.

```bash
docker run \
  -p 8084:8084 \
  -v "$(pwd)/myconfig.json:/app/config.docker.json:ro" \
  -e GITHUB_TOKEN=ghp_xxx_if_used_in_headers \
  ghcr.io/growthspace-engineering/gs-mcp-proxy-pii-redactor:latest
```

### Option 2 — Use a different path or a URL

Override the container command to pass a different file path or a URL.

```bash
# Using a different file path inside the container
docker run \
  -p 8084:8084 \
  -v "$(pwd)/myconfig.json:/app/myconfig.json:ro" \
  ghcr.io/growthspace-engineering/gs-mcp-proxy-pii-redactor:latest \
  node dist/main.js --config /app/myconfig.json

# Loading from a URL
docker run \
  -p 8084:8084 \
  ghcr.io/growthspace-engineering/gs-mcp-proxy-pii-redactor:latest \
  node dist/main.js --config https://example.com/myconfig.json

# If the URL uses a self-signed certificate, add --insecure
```

### Option 3 — Docker Compose

```yaml
services:
  mcp-proxy:
    image: ghcr.io/growthspace-engineering/gs-mcp-proxy-pii-redactor:latest
    ports:
      - "8084:8084"
    volumes:
      - ./myconfig.json:/app/config.docker.json:ro
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    # Or use a custom config path or URL by overriding the command:
    # command: ["node", "dist/main.js", "--config", "/app/myconfig.json"]
```

## Notes

- Environment variables inside config headers (e.g., `${GITHUB_TOKEN}`) are expanded inside the container. Pass them with `-e VAR=value` or via Compose `environment:`.
- The listener is set by `mcpProxy.addr` in your config (default `:8084`). If you change it, update your `-p` mapping accordingly.
- Supported server modes: set `mcpProxy.type` to `streamable-http` (default, recommended), `sse`, or `stdio`.

## Minimal example config

```json
{
  "mcpProxy": {
    "baseURL": "http://0.0.0.0:8084",
    "addr": ":8084",
    "name": "MCP Proxy",
    "version": "1.0.0",
    "type": "streamable-http",
    "options": { "logEnabled": true }
  },
  "mcpServers": {
    "github": {
      "transportType": "streamable-http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" }
    }
  }
}
```


