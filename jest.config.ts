import * as path from 'path';
import type { Config } from 'jest';

const __dirname = path.resolve();

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': [
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
    'unit',
    'coverage',
  ),
  coverageReporters: ['json', 'text', 'lcov', 'clover', 'json-summary', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Performance optimizations
  maxWorkers: '75%',
  // Reporters
  reporters: [
    'default',
    [
      'jest-stare',
      {
        resultDir: path.join(
          __dirname,
          'test-results',
          'gs-mcp-proxy-pii-redactor',
          'unit',
        ),
        reportTitle: 'gs-mcp-proxy-pii-redactor Test Results',
        reportHeadline: 'gs-mcp-proxy-pii-redactor Test Results',
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
          'unit',
        ),
        outputName: 'junit.xml',
      },
    ],
  ],
};

export default config;
