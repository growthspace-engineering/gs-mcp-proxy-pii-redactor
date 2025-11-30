#!/usr/bin/env node

import { homedir } from 'os';
import { join } from 'path';

import * as commander from 'commander';
import { copySync, ensureDirSync, pathExistsSync, readJsonSync } from 'fs-extra';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ConfigService } from './config/config.service';
import { MCPServerService } from './mcp/mcp-server.service';
import { AppModule } from './app.module';

// When running in stdio mode, absolutely nothing should be written to stdout
// except the JSON-RPC stream. Detect via CLI flag and silence/redirect logs.
const isStdioCLI = process.argv.includes('--stdio-target');
const debugMode = process.env.MCP_DEBUG === '1';
if (isStdioCLI && !debugMode) {
  // Disable Nest's internal logger entirely
  Logger.overrideLogger(false);
  // Redirect common console outputs to stderr to avoid corrupting stdout
  const writeToStderr = (...args: unknown[]) => {
    try {
      const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      process.stderr.write(line + '\n');
    } catch {
      process.stderr.write('\n');
    }
  };
  (console as unknown as { log: (...args: unknown[]) => void }).log = writeToStderr;
  (console as unknown as { info: (...args: unknown[]) => void }).info = writeToStderr;
  (console as unknown as { warn: (...args: unknown[]) => void }).warn = writeToStderr;
} else if (isStdioCLI && debugMode) {
  // In debug mode, allow logging to stderr for troubleshooting
  const writeToStderr = (...args: unknown[]) => {
    try {
      const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      process.stderr.write('[DEBUG] ' + line + '\n');
    } catch {
      process.stderr.write('\n');
    }
  };
  (console as unknown as { log: (...args: unknown[]) => void }).log = writeToStderr;
  (console as unknown as { info: (...args: unknown[]) => void }).info = writeToStderr;
  (console as unknown as { warn: (...args: unknown[]) => void }).warn = writeToStderr;
  (console as unknown as { error: (...args: unknown[]) => void }).error = writeToStderr;
}

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const program = new commander.Command();
  program
    .option('-c, --config <path>', 'path to config file or a http(s) url', 'config.json')
    .option('--insecure', 'allow insecure HTTPS connections', false)
    .option('-v, --version', 'print version and exit', false)
    .option('-h, --help', 'print help and exit', false)
    .option('--init', 'initialize a default config in the user directory and exit', false)
    .option('--init-dest <dir>', 'destination directory for --init (overrides default)')
    .option('--stdio-target <name>', 'target downstream server name when running in stdio mode')
    .option('--group <name>', 'group name to filter MCP servers (only servers in this group will expose tools)');

  program.parse(process.argv);
  const options = program.opts();

  if (options.help) {
    program.help();
    return;
  }

  if (options.version) {
    const packageJson = readJsonSync(join(__dirname, '../package.json'));
    console.log(packageJson.version);
    return;
  }

  if (options.init) {
    const destinationDir = (options.initDest as string | undefined) || join(homedir(), 'gs-mcp-proxy');
    const destinationPath = join(destinationDir, 'config.json');
    const sourcePath = join(__dirname, '../config.json');

    try {
      ensureDirSync(destinationDir);
      if (pathExistsSync(destinationPath)) {
        logger.log(`Config already exists at ${ destinationPath }`);
        process.exit(0);
      }
      copySync(sourcePath, destinationPath, { overwrite: false, errorOnExist: true });
      logger.log(`Default config copied to ${ destinationPath }`);
      process.exit(0);
    } catch (error) {
      logger.error(`Failed to initialize config: ${ error }`);
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule, {
    // Preserve raw body for SSE transport
    rawBody: true,
    logger: (isStdioCLI && !debugMode) ? false : undefined
  });
  const configService = app.get(ConfigService);

  try {
    await configService.load(options.config, options.insecure);
    logger.log('Configuration loaded successfully');

    // Set the active group if provided via CLI flag
    const groupName = options.group as string | undefined;
    if (groupName) {
      configService.setActiveGroup(groupName);
      logger.log(`Active group set to: ${ groupName }`);
    }
  } catch (error) {
    logger.error(`Failed to load config: ${ error }`);
    process.exit(1);
  }

  // Ensure all modules run their lifecycle hooks (e.g., MCPServerService.onModuleInit)
  await app.init();

  const config = configService.getConfig();
  if (config.mcpProxy.type === 'stdio') {
    const targetArg = options.stdioTarget as string | undefined;
    const serverNames = Object.keys(config.mcpServers || {});
    const targetName =
      targetArg || (serverNames.length === 1 ? serverNames[0] : undefined);

    if (!targetName) {
      logger.error(
        'In stdio mode, you must specify exactly one downstream or pass ' +
        '--stdio-target <name>'
      );
      await app.close();
      process.exit(1);
      return;
    }

    const mcpService = app.get(MCPServerService);
    const instance = mcpService.getServer(targetName);
    if (!instance) {
      logger.error(`Downstream server "${ targetName }" not found`);
      await app.close();
      process.exit(1);
      return;
    }

    logger.log(
      `Starting MCP proxy in stdio mode targeting "${ targetName }"`
    );
    const transport = new StdioServerTransport();

    try {
      logger.log('About to call server.connect()...');
      await instance.server.connect(transport);
      logger.log('MCP server connected and listening for requests');

      // Initialize downstream client in background after handshake completes
      // This ensures tools are available when the client asks for them
      logger.log('Triggering downstream client initialization...');
      instance.clientWrapper.initialize().then(() => {
        logger.log('Downstream client initialized successfully');
      }).catch((error) => {
        logger.error(`Failed to initialize downstream client: ${ error }`);
      });
    } catch (error) {
      logger.error(`Failed to connect MCP server: ${ error }`);
      logger.error(`Error stack: ${ (error as Error).stack }`);
      await app.close();
      process.exit(1);
    }

    const shutdown = async () => {
      try {
        logger.log('Shutdown signal received');
        await app.close();
      } finally {
        process.exit(0);
      }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep the process alive indefinitely
    // server.connect() doesn't block, so we need to prevent the process from exiting
    await new Promise(() => {
      // This promise never resolves, keeping the process alive
    });

    return;
  }

  const port = config.mcpProxy.addr.replace(':', '') || 8083;
  await app.listen(port);
  logger.log(`Server listening on port ${ port }`);
}

// Global error handlers to catch any unhandled errors in stdio mode
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${ promise }, reason: ${ reason }`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${ error }`);
  process.exit(1);
});

bootstrap().catch((error) => {
  logger.error(`Failed to start server: ${ error }`);
  process.exit(1);
});

