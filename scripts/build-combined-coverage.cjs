#!/usr/bin/env node
/*
Usage:
  node scripts/build-combined-coverage.cjs [unitRoot] [e2eRoot] [outDir]

Defaults (when no args provided):
  unitRoot = '.'
  e2eRoot = '.'
  outDir  = 'test-results/gs-mcp-proxy-pii-redactor/combined-coverage'

This script will:
  - Merge coverage from:
      unitRoot/test-results/gs-mcp-proxy-pii-redactor/unit/coverage
      e2eRoot/test-results/gs-mcp-proxy-pii-redactor/e2e/coverage
  - Generate HTML + lcov under outDir
  - Inject Kibibit theme into outDir
*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const unitRoot = process.argv[2] || '.';
const e2eRoot = process.argv[3] || '.';
const outDir =
  process.argv[4] ||
  path.join('test-results', 'gs-mcp-proxy-pii-redactor', 'combined-coverage');

const unitCoverage = path.join(
  unitRoot,
  'test-results',
  'gs-mcp-proxy-pii-redactor',
  'unit',
  'coverage',
);
const e2eCoverage = path.join(
  e2eRoot,
  'test-results',
  'gs-mcp-proxy-pii-redactor',
  'e2e',
  'coverage',
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function existsDir(dir) {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

(function main() {
  if (!existsDir(unitCoverage)) {
    console.error(`❌ Unit coverage path not found: ${unitCoverage}`);
    process.exit(1);
  }
  if (!existsDir(e2eCoverage)) {
    console.error(`❌ E2E coverage path not found: ${e2eCoverage}`);
    process.exit(1);
  }

  ensureDir(outDir);

  const tmpDir = path.join(outDir, '_merge_input');
  ensureDir(tmpDir);

  const unitFile = path.join(unitCoverage, 'coverage-final.json');
  const e2eFile = path.join(e2eCoverage, 'coverage-final.json');
  if (!fs.existsSync(unitFile)) {
    console.error(`❌ Missing unit coverage-final.json at ${unitFile}`);
    process.exit(1);
  }
  if (!fs.existsSync(e2eFile)) {
    console.error(`❌ Missing e2e coverage-final.json at ${e2eFile}`);
    process.exit(1);
  }

  fs.copyFileSync(unitFile, path.join(tmpDir, 'unit.json'));
  fs.copyFileSync(e2eFile, path.join(tmpDir, 'e2e.json'));

  run(`npx nyc merge ${tmpDir} ${path.join(outDir, 'coverage-final.json')}`);
  run(`npx nyc report -t ${outDir} -r html -r lcov -r json-summary --report-dir ${outDir}`);
  run(`node scripts/inject-themes.cjs ${outDir} gs-mcp-proxy-pii-redactor`);

  console.log('✅ Combined coverage generated at:', outDir);
})();
