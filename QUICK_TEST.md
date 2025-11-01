# Quick Testing Guide

## ✅ Current Status

All core tests are passing! The following components are working:

- ✅ Config loading and parsing
- ✅ Environment variable expansion
- ✅ Redaction matcher (with GCS integration - 53,552 terms loaded!)
- ✅ Generic scanner (emails/phones)
- ✅ Redaction service
- ✅ TypeScript compilation

## 🚀 Quick Test Commands

### 1. Run All Setup Tests
```bash
npm run test:setup
```
**Expected:** All 5 tests should pass ✅

### 2. Build the Project
```bash
npm run build
```
**Expected:** Creates `dist/` directory with compiled JavaScript

### 3. Test the Server (Basic)
```bash
# Start the server
npm run start:dev

# In another terminal, test health endpoint
curl http://localhost:8083
```
**Expected:** `{"status":"ok"}`

### 4. Test with Custom Config
```bash
npm run start:prod -- --config config.json
```

### 5. Test Redaction Manually
```bash
node -e "
const { RedactionService } = require('./dist/redaction/redaction.service');
const service = new RedactionService();

const testData = {
  content: {
    description: 'Contact John Doe at john@example.com or call +1-555-123-4567'
  }
};

service.initialize().then(() => {
  const config = { enabled: true, keys: ['description'] };
  const redacted = service.redactResponse(testData, config);
  console.log(JSON.stringify(redacted, null, 2));
});
"
```

## 📋 What's Working

1. **Configuration System**
   - Loads `config.json` successfully
   - Expands environment variables in headers (`${GITHUB_TOKEN}`)
   - Validates config structure

2. **Redaction Service**
   - Successfully connects to GCS and loads PII lists (53,552 terms!)
   - Matcher correctly identifies and redacts PII
   - Generic scanner catches emails and phone numbers
   - Key-based redaction works

3. **TypeScript Compilation**
   - All code compiles without errors
   - Type checking passes

## ⚠️ What's Not Yet Complete

1. **MCP SDK Integration**
   - Client transports (stdio, SSE, streamable-http) are placeholders
   - Server transports need implementation
   - Actual MCP protocol handling

2. **HTTP Server**
   - Health endpoint works ✅
   - MCP routing is incomplete
   - Authentication middleware not implemented

3. **Tool Filtering**
   - Logic exists but needs integration with MCP calls

## 🧪 Test Scenarios

### Scenario 1: Config Loading
```bash
# Test with invalid config (should fail gracefully)
cp config.json config.json.backup
echo '{"invalid": "config"}' > config.json
npm run test:setup  # Should show config loading error
mv config.json.backup config.json
```

### Scenario 2: Environment Variables
```bash
# Test env var expansion
export GITHUB_TOKEN=test_12345
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
console.log('GitHub header:', config.mcpServers.github?.headers?.Authorization);
"
```

### Scenario 3: Redaction
```bash
# Test different redaction configs
node -e "
const { RedactionService } = require('./dist/redaction/redaction.service');
const service = new RedactionService();

const data = {
  description: 'John Doe email: john@example.com',
  other: 'This should not be redacted'
};

service.initialize().then(() => {
  // Test key-based redaction
  const config1 = { enabled: true, keys: ['description'] };
  const r1 = service.redactResponse(data, config1);
  console.log('Key-based:', JSON.stringify(r1, null, 2));
  
  // Test all-string redaction
  const config2 = { enabled: true, keys: [] };
  const r2 = service.redactResponse(data, config2);
  console.log('All-strings:', JSON.stringify(r2, null, 2));
});
"
```

## 🔍 Debugging

### Check if server is running
```bash
curl http://localhost:8083
# or
lsof -i :8083
```

### View logs
```bash
# If using start:dev, logs appear in terminal
# For production, check console output
```

### Verify GCS connection
```bash
# Check if GCS credentials are set
echo $MCP_PROXY_SERVICE_ACCOUNT | head -c 50
# Should show JSON start if set
```

## 📝 Next Steps

1. **Complete MCP SDK Integration**
   - Verify `@modelcontextprotocol/sdk` API
   - Implement client transports
   - Implement server transports

2. **Complete HTTP Server**
   - Add MCP routing
   - Implement authentication middleware
   - Add error handling

3. **Integration Testing**
   - Test with actual MCP servers
   - Verify end-to-end flow

## 🎯 Success Criteria

When fully working, you should be able to:

1. ✅ Load config.json (DONE)
2. ✅ Start server on configured port (DONE)
3. ✅ Health endpoint responds (DONE)
4. ⏳ Proxy MCP requests through HTTP
5. ⏳ Apply redaction to responses
6. ⏳ Filter tools based on config
7. ⏳ Handle authentication

**Current Progress: ~40% complete** ✅

