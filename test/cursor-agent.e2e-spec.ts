import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Optional E2E: validates that cursor-agent can load our MCP via stdio and respond to /mcp list
// Skips automatically if cursor-agent is not installed or GITHUB_TOKEN is missing

describe('cursor-agent integration (optional e2e)', () => {
  const resolveToken = () =>
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_PAT ||
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
    '';

  const hasCursorAgent = (): boolean => {
    try {
      const r = spawnSync('cursor-agent', [ '--help' ], { stdio: 'ignore' });
      // --help often exits 0/1 depending on version
      return r.status === 0 || r.status === 1;
    } catch {
      return false;
    }
  };

  const token = resolveToken();
  const skip = !hasCursorAgent() || !token;
  const maybeIt = skip ? it.skip : it;

  let tmpDir: string;

  beforeAll(() => {
    if (skip) return;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-agent-e2e-'));
    const cursorDir = path.join(tmpDir, '.cursor');
    fs.mkdirSync(cursorDir);

    // Minimal stdio config that exposes the github downstream through our proxy
    const mcpConfig = {
      mcpServers: {
        'proxied-github': {
          command: 'npx',
          args: [
            '-y',
            '@growthspace-engineering/gs-mcp-proxy-pii-redactor',
            '--stdio-target',
            'github'
          ],
          env: {
            GITHUB_TOKEN: '${GITHUB_TOKEN}'
          }
        }
      }
    } as const;

    fs.writeFileSync(
      path.join(cursorDir, 'mcp.json'),
      JSON.stringify(mcpConfig, null, 2)
    );
  });

  afterAll(() => {
    if (skip) return;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  maybeIt('lists MCPs via headless JSON output', async () => {
    // Run in headless mode with JSON output and a direct /mcp list prompt
    const child = spawn('cursor-agent', [
      '--approve-mcps',
      '--print',
      '--output-format', 'json',
      '/mcp list'
    ], {
      cwd: tmpDir,
      env: { ...process.env, GITHUB_TOKEN: token },
      stdio: [ 'ignore', 'pipe', 'pipe' ]
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });

    const { out, err } = await new Promise<{ out: string; err: string }>((resolve) => {
      const timeout = setTimeout(() => resolve({ out: stdout, err: stderr }), 60000);
      child.on('exit', () => {
        clearTimeout(timeout);
        resolve({ out: stdout, err: stderr });
      });
    });

    // Parse last JSON line if present
    const lines = out.split(/\r?\n/).filter(Boolean);
    const last = lines.pop() || '';
    let parsed: any = null;
    try { parsed = JSON.parse(last); } catch {}

    expect(err).not.toMatch(/Connection closed|MCP error -32000/i);
    expect(parsed && parsed.type === 'result').toBe(true);
    expect(parsed?.is_error === false).toBe(true);
    const text: string = parsed?.result || '';
    expect(typeof text).toBe('string');
  }, 60000);

  maybeIt('calls a proxied-github tool via headless JSON prompt', async () => {
    // Ask the agent to call search_repositories deterministically and return JSON only
    const prompt = [
      'Call the MCP tool `search_repositories` on server `proxied-github`',
      'with the following arguments as JSON:',
      '{"query":"achievibit in:name user:Kibibit","perPage":1,"order":"desc","sort":"updated"}.',
      'Return ONLY a compact JSON object with either',
      '{"total_count":number,"items":[{...}]} or',
      '{"repositories":{"totalCount":number,"nodes":[{...}]}}',
      'and nothing else.'
    ].join(' ');

    const child = spawn('cursor-agent', [
      '--approve-mcps',
      '--print',
      '--output-format', 'json',
      prompt
    ], {
      cwd: tmpDir,
      env: { ...process.env, GITHUB_TOKEN: token },
      stdio: [ 'ignore', 'pipe', 'pipe' ]
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });

    const { out, err } = await new Promise<{ out: string; err: string }>((resolve) => {
      const timeout = setTimeout(() => resolve({ out: stdout, err: stderr }), 60000);
      child.on('exit', () => {
        clearTimeout(timeout);
        resolve({ out: stdout, err: stderr });
      });
    });

    expect(err).not.toMatch(/Connection closed|MCP error -32000/i);

    // Parse final JSON envelope from agent
    const lines = out.split(/\r?\n/).filter(Boolean);
    const last = lines.pop() || '';
    let parsed: any = null;
    try { parsed = JSON.parse(last); } catch {}
    expect(parsed && parsed.type === 'result').toBe(true);

    // Try to parse the result as JSON; otherwise treat as text
    const raw: string = parsed?.result || '';
    let resultJson: any = null;
    try { resultJson = JSON.parse(raw); } catch {}

    if (resultJson) {
      // Validate flexible shapes
      const hasTotal = typeof resultJson?.total_count === 'number' ||
        typeof resultJson?.repositories?.total_count === 'number' ||
        typeof resultJson?.repositories?.totalCount === 'number';
      expect(hasTotal).toBe(true);
    } else {
      // Fallback heuristic when the agent adds minimal wrapping
      expect(/achievibit|repositories|items/i.test(raw)).toBe(true);
    }
  }, 60000);
});


