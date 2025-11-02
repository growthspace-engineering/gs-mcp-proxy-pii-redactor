import * as path from 'path';
import type { Config } from 'jest';

const __dirname = path.resolve();

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: '.e2e-spec.ts$',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
  coverageDirectory: path.join(
    __dirname,
    'test-results',
    'gs-mcp-proxy-pii-redactor',
    'e2e',
    'coverage',
  ),
  coverageReporters: ['json', 'text', 'lcov', 'clover', 'json-summary', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  maxWorkers: '75%',
  // Verbose output for better readability
  verbose: true,
  // Mitigate occasional Node event-loop linger after reporters finish
  detectOpenHandles: true,
  forceExit: true,
  reporters: [
    'default',
    [
      'jest-stare',
      {
        resultDir: path.join(
          __dirname,
          'test-results',
          'gs-mcp-proxy-pii-redactor',
          'e2e',
        ),
        reportTitle: 'gs-mcp-proxy-pii-redactor E2E Test Results',
        reportHeadline: 'gs-mcp-proxy-pii-redactor E2E Test Results',
        additionalResultsProcessors: [],
        coverageLink: './coverage/index.html',
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: path.join(
          __dirname,
          'test-results',
          'gs-mcp-proxy-pii-redactor',
          'e2e',
        ),
        outputName: 'junit.xml',
      },
    ],
  ],
};

export default config;
