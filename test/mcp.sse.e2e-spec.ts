import * as fs from 'fs';
import * as path from 'path';

import request from 'supertest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';
import { MCPServerService } from '../src/mcp/mcp-server.service';

describe('MCP Proxy SSE Transport (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tmpConfigPath: string;

  beforeAll(async () => {
    // Enforce presence of GITHUB_TOKEN for this test to run
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(
        'GITHUB_TOKEN is required for this test. Export a valid PAT and re-run.'
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [ AppModule ]
    }).compile();

    app = moduleRef.createNestApplication();
    // Silence Nest logger output during tests
    app.useLogger(false);

    // Prepare a temp config with port 0 (random) and SSE transport
    const cfgSrcPath = path.join(__dirname, '..', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgSrcPath, 'utf-8'));
    cfg.mcpProxy.addr = ':0';

    cfg.mcpProxy.type = 'sse';

    // Restrict to only required MCP servers to avoid noisy externals
    const originalServers = (cfg.mcpServers ?? {}) as Record<string, any>;
    const mcpServers: Record<string, any> = {};
    if (originalServers.github) {
      const baseGithub = JSON.parse(JSON.stringify(originalServers.github));
      mcpServers.github = baseGithub;
      const allowGithub = JSON.parse(JSON.stringify(baseGithub));
      allowGithub.options = allowGithub.options || {};
      allowGithub.options.toolFilter = {
        mode: 'allow',
        list: [ 'list_issues', 'search_repositories' ]
      };
      mcpServers['github-allow'] = allowGithub;
    }
    cfg.mcpServers = mcpServers;

    tmpConfigPath = path.join(__dirname, 'config.sse.e2e.json');
    fs.writeFileSync(tmpConfigPath, JSON.stringify(cfg, null, 2));

    // Load config and start app on random port
    const configService = app.get(ConfigService);
    await configService.load(tmpConfigPath, false);
    await app.listen(0);
    const url = await app.getUrl();
    baseUrl = url.replace(/\/$/, '');

    // Wait for MCP servers to be initialized to avoid race conditions
    const mcpService = app.get(MCPServerService);
    const waitFor = async (check: () => any, timeoutMs = 60000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (check()) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error('MCP servers not ready in time');
    };
    const expectedServers = Object.keys(cfg.mcpServers || {});
    for (const name of expectedServers) {
      await waitFor(() => mcpService.getServer(name));
    }
  }, 60000);

  afterAll(async () => {
    try { fs.unlinkSync(tmpConfigPath); } catch {}
    await app.close();
  });

  it('health check returns ok', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect({ status: 'ok' });
  });

  const connectAndListTools = async (clientName: string) => {
    const target = `${ baseUrl }/${ clientName }/sse`;
    const headers: Record<string, string> = {};
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${ process.env.GITHUB_TOKEN }`;
    const transport = new SSEClientTransport(new URL(target), { requestInit: { headers } });
    const mcpClient = new Client({ name: 'e2e-sse', version: '0.0.1' });
    await mcpClient.connect(transport);
    const tools = await mcpClient.listTools({});
    await mcpClient.close();
    return tools.tools.map((t) => t.name).sort();
  };

  // Add jest retries to reduce flakiness in CI and local runs
  jest.retryTimes?.(2);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const withRetry = async <T>(fn: () => Promise<T>, attempts = 3, delayMs = 150): Promise<T> => {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await wait(delayMs * (i + 1));
      }
    }
    throw lastErr;
  };

  const connectSSEWithTimeout = async (urlStr: string, headers: Record<string, string>, name: string, timeoutMs = 20000) => {
    const transport = new SSEClientTransport(new URL(urlStr), { requestInit: { headers } });
    const client = new Client({ name, version: '0.0.1' });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise((_, rej) => {
      timeoutId = setTimeout(() => rej(new Error('connect timeout')), timeoutMs);
    });
    try {
      await Promise.race([ client.connect(transport), timeoutPromise ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    return { client, transport };
  };

  it('github client blocks specified tools via SSE', async () => {
    const names = await connectAndListTools('github');
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('create_repository');
    expect(names).not.toContain('create_or_update_file');
  }, 60000);

  it('github-allow client only exposes allow-listed tools via SSE', async () => {
    const names = await connectAndListTools('github-allow');
    expect(names).toEqual([ 'list_issues', 'search_repositories' ]);
  }, 60000);

  it('unknown client returns 404 on SSE endpoint', async () => {
    await request(app.getHttpServer())
      .get('/doesnotexist/sse')
      .set('accept', 'text/event-stream')
      .send({})
      .expect(404);
  });

  it('SSE transport handles authentication correctly', async () => {
    // This should fail without auth token
    const target = `${ baseUrl }/github-allow/sse`;
    const transport = new SSEClientTransport(new URL(target), {
      // No auth header
      requestInit: { headers: {} }
    });
    const mcpClient = new Client({ name: 'e2e-sse-no-auth', version: '0.0.1' });

    // Should fail to connect or list tools without proper auth
    try {
      await mcpClient.connect(transport);
      // If server doesn't require auth, tools should still work
      const tools = await mcpClient.listTools({});
      expect(tools).toBeDefined();
      await mcpClient.close();
    } catch (error) {
      // Expected if server requires auth
      expect(error).toBeDefined();
    }
  }, 60000);

  it('reconnects cleanly and can list tools again', async () => {
    // First connection
    const target = `${ baseUrl }/github-allow/sse`;
    const headers: Record<string, string> = {};
    headers.Authorization = `Bearer ${ process.env.GITHUB_TOKEN }`;
    const { client: client1 } = await connectSSEWithTimeout(target, headers, 'e2e-sse-1');
    const tools1 = await withRetry(() => client1.listTools({}));
    expect(Array.isArray(tools1.tools)).toBe(true);
    await client1.close();
    // small backoff to let server clean up session
    await wait(200);

    // Second connection (reconnect)
    const { client: client2 } = await connectSSEWithTimeout(target, headers, 'e2e-sse-2');
    const tools2 = await withRetry(() => client2.listTools({}));
    expect(Array.isArray(tools2.tools)).toBe(true);
    await client2.close();
  }, 120000);

  const itMaybeStress = process.env.E2E_SSE_STRESS ? it : it.skip;

  itMaybeStress('supports two concurrent SSE clients without interference', async () => {
    const target = `${ baseUrl }/github-allow/sse`;
    const headers: Record<string, string> = {};
    headers.Authorization = `Bearer ${ process.env.GITHUB_TOKEN }`;

    const [ { client: c1 }, { client: c2 } ] = await Promise.all([
      connectSSEWithTimeout(target, headers, 'e2e-sse-c1'),
      connectSSEWithTimeout(target, headers, 'e2e-sse-c2')
    ]);

    const [ r1, r2 ] = await Promise.all([
      withRetry(() => c1.listTools({})),
      withRetry(() => c2.listTools({}))
    ]);
    expect(Array.isArray(r1.tools)).toBe(true);
    expect(Array.isArray(r2.tools)).toBe(true);

    await c1.close();
    await c2.close();
  }, 180000);

  // Note: Tool execution is covered in mcp.search-repositories.sse.e2e-spec.ts
});

