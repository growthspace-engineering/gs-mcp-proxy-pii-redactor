# Testing Guide

This guide will help you test the current setup step by step.

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Ensure Node.js 18+ is installed:**
   ```bash
   node --version
   ```

## Step 1: Run Setup Tests

Run the automated test suite to validate core functionality:

```bash
npm run test:setup
```

This will test:
- ✅ Config loading from `config.json`
- ✅ Redaction matcher functionality
- ✅ Generic scanner (emails/phones)
- ✅ Environment variable expansion
- ✅ Redaction service

## Step 2: Test TypeScript Compilation

Check if the code compiles without errors:

```bash
npm run build
```

This should create a `dist/` directory with compiled JavaScript.

## Step 3: Test Config Loading

Create a minimal test config to verify config loading works:

```bash
# Ensure config.json exists
cat config.json

# Try loading it programmatically
node -e "
const { ConfigService } = require('./dist/config/config.service');
const service = new ConfigService();
service.load('config.json', false).then(() => {
  const config = service.getConfig();
  console.log('Config loaded:', config.mcpProxy.name);
}).catch(err => console.error('Error:', err));
"
```

## Step 4: Test HTTP Server (Basic)

Try starting the server (it won't fully work yet, but you can check for basic errors):

```bash
npm run start:dev
```

Or build and run:

```bash
npm run build
npm run start:prod -- --config config.json
```

The server should start on port 8083 (or whatever is in your config). You can test the health endpoint:

```bash
curl http://localhost:8083
```

Expected response:
```json
{"status":"ok"}
```

## Step 5: Test Redaction (Manual)

Test the redaction functionality directly:

```bash
node -e "
const { RedactionService } = require('./dist/redaction/redaction.service');
const service = new RedactionService();

const testData = {
  content: {
    description: 'Contact John Doe at john@example.com'
  }
};

const config = { enabled: true, keys: ['description'] };
const redacted = service.redactResponse(testData, config);
console.log('Redacted:', JSON.stringify(redacted, null, 2));
"
```

## Step 6: Test Environment Variable Expansion

```bash
# Set a test variable
export GITHUB_TOKEN=test_token_12345

# Test config with env var expansion
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
console.log('GitHub token header:', config.mcpServers.github?.headers?.Authorization);
"
```

## Known Limitations

⚠️ **Current Status:**

1. **MCP SDK Integration**: Not yet implemented - the client/server transports are placeholders
2. **HTTP Server**: Basic structure exists but MCP routing is incomplete
3. **GCS Integration**: Redaction service will fail to initialize without GCS credentials (expected)
4. **Authentication**: Middleware not yet implemented

## Next Steps

Once basic tests pass:

1. Verify `@modelcontextprotocol/sdk` API structure
2. Implement actual MCP client transports
3. Implement MCP server transports
4. Complete HTTP routing for MCP endpoints
5. Add authentication middleware

## Troubleshooting

**"Cannot find module '@modelcontextprotocol/sdk'"**
- Run `npm install` to ensure dependencies are installed

**"Config file not found"**
- Ensure `config.json` exists in the project root
- Or specify path: `npm run start:prod -- --config /path/to/config.json`

**"Redaction service init failed"**
- This is expected if GCS credentials are not set
- Set `MCP_PROXY_SERVICE_ACCOUNT` or `MCP_PROXY_SERVICE_ACCOUNT_B64` environment variables

**Build errors**
- Check TypeScript version: `npm list typescript`
- Clear and rebuild: `rm -rf dist && npm run build`

