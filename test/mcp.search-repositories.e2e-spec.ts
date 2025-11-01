/* eslint-disable */
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

describe('MCP Proxy search_repositories (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tmpConfigPath: string;

  const resolveToken = () =>
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_PAT ||
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
    '';
  // Note: we will enforce presence of GITHUB_TOKEN in beforeAll

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);

    // Prepare a temp config using only github-allow with explicit allow list
    const cfgSrcPath = path.join(__dirname, '..', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgSrcPath, 'utf-8'));
    cfg.mcpProxy.addr = ':0';

    const originalServers = (cfg.mcpServers ?? {}) as Record<string, any>;
    const mcpServers: Record<string, any> = {};
    if (originalServers.github) {
      const allowGithub = JSON.parse(JSON.stringify(originalServers.github));
      allowGithub.options = allowGithub.options || {};
      allowGithub.options.toolFilter = {
        mode: 'allow',
        list: ['list_issues', 'search_repositories'],
      };
      // Ensure Authorization header is set explicitly with the resolved token
      const token = resolveToken();
      allowGithub.headers = allowGithub.headers || {};
      allowGithub.headers.Authorization = `Bearer ${token}`;
      mcpServers['github-allow'] = allowGithub;
    }
    cfg.mcpServers = mcpServers;

    tmpConfigPath = path.join(__dirname, 'config.search.e2e.json');
    fs.writeFileSync(tmpConfigPath, JSON.stringify(cfg, null, 2));

    const configService = app.get(ConfigService);
    await configService.load(tmpConfigPath, false);
    // Enforce presence of GITHUB_TOKEN for this test to run
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(
        'GITHUB_TOKEN is required for this test. Export a valid PAT and re-run.',
      );
    }
    await app.listen(0);
    const url = await app.getUrl();
    baseUrl = url.replace(/\/$/, '');
  }, 60000);

  afterAll(async () => {
    try {
      fs.unlinkSync(tmpConfigPath);
    } catch {}
    await app.close();
  });

  const connectClient = async (clientName: string) => {
    const target = `${baseUrl}/${clientName}`;
    const headers: Record<string, string> = {};
    const token = resolveToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const transport = new StreamableHTTPClientTransport(new URL(target), {
      requestInit: { headers },
    });
    const mcpClient = new Client({ name: 'e2e', version: '0.0.1' });
    await mcpClient.connect(transport);
    return mcpClient;
  };

  it('exposes search_repositories on github-allow and executes it', async () => {
      const mcpClient = await connectClient('github-allow');
      try {
        const tools = await mcpClient.listTools({});
        const names = tools.tools.map((t) => t.name).sort();
        expect(names).toContain('search_repositories');

        const resp = await mcpClient.callTool({
          name: 'search_repositories',
          arguments: {
            query: 'achievibit in:name user:Kibibit',
            perPage: 1,
            order: 'desc',
            sort: 'updated',
          },
        });

        expect(resp).toBeDefined();
        // Validate MCP envelope matches what agents/hosts expect
        const envelope = resp as any;
        expect(Array.isArray(envelope.content)).toBe(true);
        const contentItem = envelope.content.find((c: any) => c?.type === 'json') || envelope.content.find((c: any) => c?.type === 'text');
        expect(contentItem).toBeDefined();
        expect(['json', 'text']).toContain(contentItem.type);
        // Unwrap MCP content wrapper if present (some servers return JSON string in content[])
        const unwrap = (r: any): any => {
          try {
            if (Array.isArray(r?.content)) {
              const txt = r.content.find((c: any) => c?.type === 'text')?.text;
              if (typeof txt === 'string' && txt.trim().startsWith('{')) {
                return JSON.parse(txt);
              }
            }
          } catch {}
          return r;
        };

        const base = unwrap(resp as any);

        // Be permissive about shape; support REST and GraphQL-like outputs
        const pickArray = (r: any): any[] => {
          if (Array.isArray(r?.items)) return r.items;
          if (Array.isArray(r?.repositories)) return r.repositories;
          if (Array.isArray(r?.repositories?.items)) {
            return r.repositories.items;
          }
          if (Array.isArray(r?.repositories?.nodes)) {
            return r.repositories.nodes;
          }
          return [];
        };
        const pickCount = (r: any, arr: any[]): number => {
          if (typeof r?.total_count === 'number') return r.total_count;
          if (typeof r?.repositories?.total_count === 'number') {
            return r.repositories.total_count;
          }
          if (typeof r?.repositories?.totalCount === 'number') {
            return r.repositories.totalCount;
          }
          return arr.length;
        };

        const itemsArr = pickArray(base);
        expect(Array.isArray(itemsArr)).toBe(true);
        const totalCount = pickCount(base, itemsArr);

        // Create a stable, minimal projection for snapshotting
        const simplify = (item: any) => {
          const visibility = (() => {
            if (item?.visibility) return item.visibility;
            if (item?.private === true) return 'private';
            if (item?.private === false) return 'public';
            return null;
          })();

          return {
            name: item?.name ?? item?.repository?.name ?? null,
            full_name: item?.full_name ?? item?.repository?.full_name ?? null,
            owner:
              item?.owner?.login ??
              item?.owner ??
              item?.repository?.owner?.login ??
              null,
            visibility,
          };
        };
        const simplified = itemsArr.slice(0, 1).map(simplify);

        const snapshotPayload = {
          count: totalCount,
          first: simplified[0] ?? null,
        };

        // Temporary debug: print raw response when empty to diagnose auth/config
        if (!snapshotPayload.count) {
          // eslint-disable-next-line no-console
          console.log(
            'GitHub MCP raw response (truncated):',
            JSON.stringify(resp).slice(0, 1000),
          );
        }

        const isError = (resp as any)?.isError === true;
        // Always require results with a valid token; this test should fail if count === 0
        expect(isError).toBe(false);
        expect(snapshotPayload.count).toBeGreaterThan(0);
        expect(snapshotPayload).toMatchSnapshot();
      } finally {
        await mcpClient.close();
      }
    }, 60000);
});
