import * as fs from 'fs';
import * as path from 'path';

import request from 'supertest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';
import { MCPServerService } from '../src/mcp/mcp-server.service';

describe('MCP Proxy (e2e)', () => {
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

    // Prepare a temp config with port 0 (random)
    const cfgSrcPath = path.join(__dirname, '..', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgSrcPath, 'utf-8'));
    cfg.mcpProxy.addr = ':0';
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

    tmpConfigPath = path.join(__dirname, 'config.e2e.json');
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
    try {
      fs.unlinkSync(tmpConfigPath);
    } catch {}
    await app.close();
  });

  it('health check returns ok', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ status: 'ok' });
  });

  const connectAndListTools = async (clientName: string) => {
    const target = `${ baseUrl }/${ clientName }`;
    const headers: Record<string, string> = {};
    if (process.env.GITHUB_TOKEN) { headers.Authorization = `Bearer ${ process.env.GITHUB_TOKEN }`; }
    const transport = new StreamableHTTPClientTransport(new URL(target), {
      requestInit: { headers }
    });
    const mcpClient = new Client({ name: 'e2e', version: '0.0.1' });
    await mcpClient.connect(transport);
    const tools = await mcpClient.listTools({});
    await mcpClient.close();
    return tools.tools.map((t) => t.name).sort();
  };

  it('github client blocks specified tools', async () => {
    const names = await connectAndListTools('github');
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('create_repository');
    expect(names).not.toContain('create_or_update_file');
  }, 60000);

  it('github-allow client only exposes allow-listed tools', async () => {
    const names = await connectAndListTools('github-allow');
    expect(names).toEqual([ 'list_issues', 'search_repositories' ]);
  }, 60000);

  it('unknown client returns 404', async () => {
    await request(app.getHttpServer())
      .post('/doesnotexist')
      .set('accept', 'application/json, text/event-stream')
      .send({})
      .expect(404);
  });

  it('reuses streamable-http session across sequential calls', async () => {
    const target = `${ baseUrl }/github-allow`;
    const headers: Record<string, string> = {};
    headers.Authorization = `Bearer ${ process.env.GITHUB_TOKEN }`;
    const transport = new StreamableHTTPClientTransport(new URL(target), { requestInit: { headers } });
    const client = new Client({ name: 'e2e-http', version: '0.0.1' });
    await client.connect(transport);
    const first = await client.listTools({});
    const second = await client.listTools({});
    expect(first.tools.length).toBeGreaterThan(0);
    expect(second.tools.length).toBe(first.tools.length);
    await client.close();
  }, 60000);
});
