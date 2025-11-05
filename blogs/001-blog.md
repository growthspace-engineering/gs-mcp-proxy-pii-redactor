# Redacting with Confidence: Building a Privacy‑First MCP Proxy for AI Agents

Modern engineering teams want the speed of AI assistants without sacrificing privacy. At GrowthSpace, our developers rely on MCP-enabled agents every day—in IDEs, CI, and internal tools. But much of the data we touch (logs, tickets, resources) may contain PII. Our constraints were clear: no PII leaves our boundary.

So we built—and open‑sourced—a lightweight MCP proxy that automatically redacts sensitive information before it ever reaches an AI agent.

## Why We Built It

- **Context**: GrowthSpace engineers use AI assistants with MCP servers across daily development and internal AI pipelines.
- **Problem**: We can’t expose any PII to AI agents (per customer and regulatory obligations). Directly wiring agents to Jira, logs, or other systems was a non‑starter.
- **Vision**: Insert a small, transparent proxy that sits between agents and tools, redacting sensitive data on the fly.

## The Challenge: AI Velocity vs. Enterprise Privacy

MCP (Model Context Protocol) gives us a clean, standardized way to connect agents to tools, prompts, and resources. But MCP intentionally doesn’t solve data governance—especially PII redaction. Enterprises need strong guarantees: controlled exposure, auditing, and compliance that doesn’t slow teams down.

Our thesis: privacy should be a drop‑in capability—not a rewrite.

## Our Solution: gs‑mcp‑proxy (with PII Redaction)

- **Drop‑in proxy**: Sits between the AI agent and downstream MCP servers (GitHub, Atlassian, GCP, and more).
- **Automatic PII redaction**: Emails, phone numbers, and names redacted using a hybrid approach (generic patterns + dictionary matching).
- **Composable and transparent**: JSON configuration; optional authentication; per‑server tool filtering; audit logging.
- **Multiple transports**: stdio, SSE, and streamable HTTP—so it fits IDEs and services alike.
- **Open source**: Trust comes from visibility. We want the community to verify and extend it.

GitHub: https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor

## How It Works

At a high level, the proxy aggregates multiple downstream MCP servers into one entrypoint and applies redaction on responses before forwarding back to the agent.

- **Proxy core**: A NestJS server exposes endpoints for SSE and streamable HTTP, and a stdio mode for IDEs. Each downstream is wrapped so its tools/prompts/resources are listed and proxied consistently.
- **Redaction pipeline**:
  - Generic scanner masks emails and international phone numbers in a single linear pass.
  - Dictionary matcher uses an Aho–Corasick automaton (case‑insensitive, whole‑word) to mask organization‑specific PII (e.g., names, terms) loaded from Google Cloud Storage (GCS).
  - Redaction is applied recursively, either across all strings or scoped to specific JSON keys (e.g., `description`, `text`, `href`).
  - Optional verbose audit logging helps debug what was redacted during development.
- **Controls & safety**:
  - Tool filtering lets you allowlist or block tools per server.
  - Bearer token auth (global or per‑server) prevents accidental exposure of the proxy.
  - Stateful transport support (streamable HTTP) keeps long‑lived sessions efficient.

### Minimal Configuration

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

### Opt‑In Redaction (per server)

Redaction is enabled and scoped per downstream server. If you specify `keys`, only those JSON keys will be redacted (recursively). If you omit `keys`, all strings are redacted.

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "mcp-remote@0.1.17", "https://mcp.atlassian.com/v1/sse"],
      "options": {
        "toolFilter": { "mode": "block", "list": ["transitionJiraIssue"] },
        "redaction": {
          "enabled": true,
          "keys": ["description", "text", "href"]
        }
      }
    }
  }
}
```

### Dictionaries from GCS

To power organization‑specific redaction, we load dictionaries from a GCS bucket at startup:

```bash
export MCP_PROXY_GCS_BUCKET=your-bucket-name
export MCP_PROXY_GCS_FILES=names.txt,emails.txt,custom.txt  # optional; defaults to names.txt,emails.txt
# Provide service account JSON directly or base64-encoded
export MCP_PROXY_SERVICE_ACCOUNT='{"type":"service_account", ...}'
# OR
export MCP_PROXY_SERVICE_ACCOUNT_B64=base64encodedjson
```

- Files are combined into one matcher.
- Matching is case‑insensitive, whole‑word only.
- Generic patterns (emails/phones) are applied before dictionary matches.

### Endpoints and Modes

- **stdio**: Ideal for IDEs like Cursor/Claude; exposes exactly one downstream via stdio.
- **SSE / streamable HTTP**: Run as an HTTP server and connect from IDEs or services via `mcp-remote`.

Example endpoints (when `baseURL = http://localhost:8084` and downstream key is `github`):

- `GET /github/sse` — establish SSE connection
- `POST /github/message` — send messages to SSE connection
- `GET|POST|DELETE /github` — streamable HTTP handler

## Real‑World Use at GrowthSpace

We route internal AI assistants through the proxy to reach systems like GitHub, Atlassian, and GCP logs—without risking PII leakage. Engineers stay productive (searching issues, reading logs, calling tools) while security teams get confidence: sensitive values are consistently replaced with `[REDACTED]` before an agent sees them.

This strikes the balance we wanted: developer agility with compliance baked in.

## Future Plans

- **Plugin‑based dictionary loading**: Today we support GCS. We plan to add a pluggable loader interface so teams can source dictionaries from S3, HTTP, Git repos, or internal stores.
- **Fine‑grained strategies**: Tunable strategies per downstream (e.g., stricter redaction for logs vs. issues).
- **Observability**: More structured audit events and metrics for platform teams.

## Open Source Impact

We released this as open source to maximize trust and adoption:

- **Transparency**: The proxy’s behavior is easy to audit and reason about.
- **Composability**: Simple JSON config; bring your own MCP servers.
- **Community**: We welcome issues, ideas, and PRs—especially around dictionary plugins and new transport use cases.

Try it in your stack and tell us what you think.

- GitHub: https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor
- Docs: `docs/` in the repo covers configuration, IDE setup, usage, and deployment

## Conclusion

Privacy shouldn’t slow down AI adoption. With a small proxy layer, you can keep shipping fast while ensuring PII never leaks to agents. gs‑mcp‑proxy lets teams integrate powerful MCP tools—safely.

If your organization faces the same tension between capability and compliance, we’d love your feedback and contributions.

---

### Appendix: Quickstart

```bash
# Install globally (optional)
npm install -g @growthspace-engineering/gs-mcp-proxy-pii-redactor

# Initialize a default config
gs-mcp-proxy --init

# Run the proxy
gs-mcp-proxy --config ~/gs-mcp-proxy/config.json
```

Use stdio for the best IDE experience, or run as an HTTP server and connect via SSE/streamable HTTP. See repo docs for per‑IDE setup.

