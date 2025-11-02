# Deployment

## Docker

### Build

```bash
npm run docker:build
```

This builds the Docker image with tags for both `latest` and the current version.

### Run

```bash
npm run docker:run
```

This runs the container with environment variables and mounts `config.json`. For minimal testing:

```bash
npm run docker:run:min
```

### Custom Docker Usage

```bash
# Build
docker build -t gs-mcp-pii-redactor:latest .

# Run with custom config
docker run --rm -p 8083:8083 \
  -e MCP_PROXY_GCS_BUCKET=your-bucket \
  -e MCP_PROXY_GCS_FILES=names.txt,emails.txt \
  -e MCP_PROXY_SERVICE_ACCOUNT_B64=base64encoded \
  -v $(pwd)/config.json:/app/config.json \
  gs-mcp-pii-redactor:latest

# Run with remote config URL
docker run --rm -p 8083:8083 \
  -e MCP_PROXY_GCS_BUCKET=your-bucket \
  -e MCP_PROXY_SERVICE_ACCOUNT_B64=base64encoded \
  gs-mcp-pii-redactor:latest \
  --config https://example.com/config.json
```

### Docker Image Details

- Base image: `node:22-alpine`
- Default port: `8083` (configurable via `config.json`)
- Default config path: `/app/config.json` (can be overridden with `--config`)

## Production Deployment

### Build for Production

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Run in Production

```bash
npm run start:prod

# With custom config
npm run start:prod -- --config /path/to/config.json

# With remote config URL
npm run start:prod -- --config https://example.com/config.json
```

### Environment Variables

Set required environment variables:

```bash
# For PII redaction (if enabled)
export MCP_PROXY_GCS_BUCKET=your-bucket-name
export MCP_PROXY_GCS_FILES=names.txt,emails.txt
export MCP_PROXY_SERVICE_ACCOUNT_B64=base64encodedjson

# For upstream MCP servers (if needed)
export GITHUB_TOKEN=your_token
```

### Process Management

For production deployments, consider using a process manager:

#### PM2

```bash
npm install -g pm2
pm2 start dist/main.js --name mcp-proxy -- --config config.json
pm2 save
pm2 startup
```

#### systemd

Create `/etc/systemd/system/mcp-proxy.service`:

```ini
[Unit]
Description=MCP Proxy with PII Redaction
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/gs-mcp-pii-redactor
Environment="MCP_PROXY_GCS_BUCKET=your-bucket"
Environment="MCP_PROXY_SERVICE_ACCOUNT_B64=base64encoded"
ExecStart=/usr/bin/node dist/main.js --config config.json
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mcp-proxy
sudo systemctl start mcp-proxy
```

## Health Check

The proxy exposes a health check endpoint:

```bash
GET /
```

Returns:

```json
{
  "status": "ok"
}
```

Use this endpoint for health checks and load balancer probes.

