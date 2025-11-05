import * as fs from 'fs';
import * as path from 'path';

import type { Config } from 'jest';

const rootDir = path.resolve();

const ensureDirectoryExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const testResultsDir = path.join(
  rootDir,
  'test-results',
  'gs-mcp-proxy-pii-redactor',
  'unit'
);

const coverageDir = path.join(testResultsDir, 'coverage');

ensureDirectoryExists(testResultsDir);
ensureDirectoryExists(coverageDir);

const config: Config = {
  displayName: 'unit',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [ '<rootDir>/src' ],
  testMatch: [ '**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts' ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs'
        }
      }
    ]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.module.ts',
    '!src/main.ts'
  ],
  coverageDirectory: coverageDir,
  coverageReporters: [ 'json', 'text', 'lcov', 'clover', 'json-summary', 'html' ],
  moduleFileExtensions: [ 'ts', 'js', 'json' ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  modulePathIgnorePatterns: [ '<rootDir>/dist/' ],
  // Performance optimizations
  maxWorkers: '75%',
  // Verbose output for better readability
  verbose: true,
  // Reporters
  reporters: [
    'default',
    [
      'jest-stare',
      {
        resultDir: testResultsDir,
        reportTitle: 'gs-mcp-proxy-pii-redactor Test Results',
        reportHeadline: 'gs-mcp-proxy-pii-redactor Test Results',
        additionalResultsProcessors: [],
        coverageLink: './coverage/index.html'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: testResultsDir,
        outputName: 'junit.xml'
      }
    ]
  ]
};

export default config;
