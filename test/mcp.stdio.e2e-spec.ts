import * as fs from 'fs';
import * as path from 'path';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('MCP Proxy Stdio Mode (e2e)', () => {
  const skip = !process.env.GITHUB_TOKEN;
  const maybeIt = skip ? it.skip : it;
  let tmpConfigPath: string;

  beforeAll(async () => {
    if (skip) return;
    // Prepare a temp config with stdio mode
    const cfgSrcPath = path.join(__dirname, '..', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgSrcPath, 'utf-8'));

    // Set stdio mode
    cfg.mcpProxy.type = 'stdio';

    // Restrict to only github-allow with allow-list
    const originalServers = (cfg.mcpServers ?? {}) as Record<string, any>;
    const mcpServers: Record<string, any> = {};
    if (originalServers.github) {
      const allowGithub = JSON.parse(JSON.stringify(originalServers.github));
      allowGithub.options = allowGithub.options || {};
      allowGithub.options.toolFilter = {
        mode: 'allow',
        list: [ 'list_issues', 'search_repositories' ]
      };
      mcpServers['github-allow'] = allowGithub;
    }
    cfg.mcpServers = mcpServers;

    tmpConfigPath = path.join(__dirname, 'config.stdio.e2e.json');
    fs.writeFileSync(tmpConfigPath, JSON.stringify(cfg, null, 2));
  }, 60000);

  afterAll(async () => {
    if (skip) return;
    try {
      fs.unlinkSync(tmpConfigPath);
    } catch {}
  });

  maybeIt('should expose only allow-listed tools via stdio', async () => {
    // Create stdio client transport - it will spawn the process via ts-node
    const mainTsPath = path.join(__dirname, '..', 'src', 'main.ts');
    const transport = new StdioClientTransport({
      command: 'node',
      args: [ '-r', 'ts-node/register', mainTsPath, '--config', tmpConfigPath, '--stdio-target', 'github-allow' ],
      env: { ...process.env }
    });

    const mcpClient = new Client({ name: 'e2e-stdio', version: '0.0.1' });
    await mcpClient.connect(transport);

    // Wait a bit for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test listTools
    const tools = await mcpClient.listTools({});
    const toolNames = tools.tools.map((t) => t.name).sort();

    expect(toolNames).toEqual([ 'list_issues', 'search_repositories' ]);

    // Optionally test calling a tool
    if (toolNames.includes('search_repositories')) {
      const result = await mcpClient.callTool({
        name: 'search_repositories',
        arguments: { query: 'language:typescript stars:>100' }
      });
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    }

    await mcpClient.close();
  }, 60000);
});

