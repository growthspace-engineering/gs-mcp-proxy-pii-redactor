import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

describe('MCP Proxy (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tmpConfigPath: string;

  const hasGithubToken = Boolean(process.env.GITHUB_TOKEN);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
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
    if (originalServers.github && hasGithubToken) {
      const baseGithub = JSON.parse(JSON.stringify(originalServers.github));
      mcpServers.github = baseGithub;
      const allowGithub = JSON.parse(JSON.stringify(baseGithub));
      allowGithub.options = allowGithub.options || {};
      allowGithub.options.toolFilter = {
        mode: 'allow',
        list: ['list_issues', 'search_repositories'],
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
  }, 60000);

  afterAll(async () => {
    try { fs.unlinkSync(tmpConfigPath); } catch {}
    await app.close();
  });

  it('health check returns ok', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect({ status: 'ok' });
  });

  const connectAndListTools = async (clientName: string) => {
    const target = `${baseUrl}/${clientName}`;
    const headers: Record<string, string> = {};
    if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    const transport = new StreamableHTTPClientTransport(new URL(target), { requestInit: { headers } });
    const mcpClient = new Client({ name: 'e2e', version: '0.0.1' });
    await mcpClient.connect(transport);
    const tools = await mcpClient.listTools({});
    await mcpClient.close();
    return tools.tools.map(t => t.name).sort();
  };

  (hasGithubToken ? it : it.skip)('github client blocks specified tools', async () => {
    const names = await connectAndListTools('github');
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('create_repository');
    expect(names).not.toContain('create_or_update_file');
  }, 60000);

  (hasGithubToken ? it : it.skip)('github-allow client only exposes allow-listed tools', async () => {
    const names = await connectAndListTools('github-allow');
    expect(names).toEqual(['list_issues', 'search_repositories']);
  }, 60000);

  it('unknown client returns 404', async () => {
    await request(app.getHttpServer())
      .post('/doesnotexist')
      .set('accept', 'application/json, text/event-stream')
      .send({})
      .expect(404);
  });
});


