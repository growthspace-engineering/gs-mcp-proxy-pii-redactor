import * as commander from 'commander';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import * as packageJson from '../package.json';
import { ConfigService } from './config/config.service';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const program = new commander.Command();
  program
    .option('-c, --config <path>', 'path to config file or a http(s) url', 'config.json')
    .option('--insecure', 'allow insecure HTTPS connections', false)
    .option('-v, --version', 'print version and exit', false)
    .option('-h, --help', 'print help and exit', false);

  program.parse(process.argv);
  const options = program.opts();

  if (options.help) {
    program.help();
    return;
  }

  if (options.version) {
    console.log(packageJson.version);
    return;
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true // Preserve raw body for SSE transport
  });
  const configService = app.get(ConfigService);

  try {
    await configService.load(options.config, options.insecure);
    logger.log('Configuration loaded successfully');
  } catch (error) {
    logger.error(`Failed to load config: ${ error }`);
    process.exit(1);
  }

  const config = configService.getConfig();
  const port = config.mcpProxy.addr.replace(':', '') || 8083;

  await app.listen(port);
  logger.log(`Server listening on port ${ port }`);
}

bootstrap().catch((error) => {
  logger.error(`Failed to start server: ${ error }`);
  process.exit(1);
});

