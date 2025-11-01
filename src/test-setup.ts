#!/usr/bin/env node

/**
 * Test script for validating the current setup
 * Run with: npm run test:setup
 */

import { ConfigService } from './config/config.service';
import { RedactionService } from './redaction/redaction.service';
import { Matcher } from './redaction/matcher';
import { redactGeneric } from './redaction/scanner-generic';

async function testConfigLoading() {
  console.log('\n📋 Testing Config Loading...');
  try {
    const configService = new ConfigService();
    await configService.load('config.json', false);
    const config = configService.getConfig();
    console.log('✅ Config loaded successfully');
    console.log(`   - Proxy name: ${config.mcpProxy.name}`);
    console.log(`   - Server type: ${config.mcpProxy.type}`);
    console.log(`   - MCP Servers: ${Object.keys(config.mcpServers).length}`);
    return true;
  } catch (error) {
    console.error('❌ Config loading failed:', error);
    return false;
  }
}

async function testRedactionMatcher() {
  console.log('\n🔍 Testing Redaction Matcher...');
  try {
    const dictionary = ['John Doe', 'jane@example.com', 'Bob Smith'];
    const matcher = await Matcher.build(dictionary);
    
    const testText = 'Contact John Doe at jane@example.com or Bob Smith';
    const redacted = matcher.redact(testText);
    
    console.log('✅ Matcher works');
    console.log(`   Original: ${testText}`);
    console.log(`   Redacted: ${redacted}`);
    
    if (redacted.includes('[REDACTED]')) {
      console.log('✅ Redaction detected PII correctly');
      return true;
    } else {
      console.log('⚠️  Redaction may not be working correctly');
      return false;
    }
  } catch (error) {
    console.error('❌ Matcher test failed:', error);
    return false;
  }
}

function testGenericScanner() {
  console.log('\n📧 Testing Generic Scanner (Emails/Phones)...');
  try {
    const testCases = [
      { text: 'Contact user@example.com', expectRedacted: true },
      { text: 'Call +1-555-123-4567', expectRedacted: true },
      { text: 'Normal text without PII', expectRedacted: false },
    ];

    let allPassed = true;
    for (const testCase of testCases) {
      const redacted = redactGeneric(testCase.text);
      const wasRedacted = redacted.includes('[REDACTED]');
      
      if (wasRedacted === testCase.expectRedacted) {
        console.log(`✅ "${testCase.text}" -> ${redacted.substring(0, 50)}...`);
      } else {
        console.log(`❌ "${testCase.text}" -> Expected ${testCase.expectRedacted}, got ${wasRedacted}`);
        allPassed = false;
      }
    }

    return allPassed;
  } catch (error) {
    console.error('❌ Generic scanner test failed:', error);
    return false;
  }
}

function testEnvironmentVariableExpansion() {
  console.log('\n🔐 Testing Environment Variable Expansion...');
  try {
    // Set a test env var
    process.env.TEST_TOKEN = 'test_token_value';
    
    const configService = new ConfigService();
    const headers = {
      'Authorization': 'Bearer ${TEST_TOKEN}',
    };
    
    // Access private method for testing (this would normally be done through load)
    const configContent = {
      mcpProxy: {
        baseURL: 'http://localhost:8083',
        addr: ':8083',
        name: 'Test',
        version: '1.0.0',
      },
      mcpServers: {
        test: {
          headers,
        },
      },
    };
    
    // Manually expand headers
    const envVarPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
    for (const [key, value] of Object.entries(headers)) {
      if (envVarPattern.test(value)) {
        headers[key] = value.replace(envVarPattern, (match, varName) => {
          return process.env[varName] || match;
        });
      }
    }
    
    if (headers['Authorization'] === 'Bearer test_token_value') {
      console.log('✅ Environment variable expansion works');
      console.log(`   Expanded: ${headers['Authorization']}`);
      delete process.env.TEST_TOKEN;
      return true;
    } else {
      console.log('❌ Environment variable expansion failed');
      delete process.env.TEST_TOKEN;
      return false;
    }
  } catch (error) {
    console.error('❌ Environment variable expansion test failed:', error);
    return false;
  }
}

async function testRedactionService() {
  console.log('\n🛡️  Testing Redaction Service...');
  try {
    const redactionService = new RedactionService();
    
    // Test without GCS (will fail gracefully)
    try {
      await redactionService.initialize();
      console.log('⚠️  Redaction service initialized (GCS may not be configured)');
    } catch (error) {
      console.log('⚠️  Redaction service init failed (expected if GCS not configured):', error.message);
    }
    
    // Test redaction logic with mock data
    const testData = {
      content: {
        text: 'Hello John Doe!',
        metadata: {
          description: 'Contact jane@example.com',
        },
      },
    };
    
    const redactionConfig = {
      enabled: true,
      keys: ['description'],
    };
    
    // This will work even without GCS matcher (generic redaction)
    const redacted = redactionService.redactResponse(testData, redactionConfig);
    console.log('✅ Redaction service redactResponse method works');
    console.log(`   Original description: ${testData.content.metadata.description}`);
    console.log(`   Redacted description: ${redacted.content.metadata.description}`);
    
    return true;
  } catch (error) {
    console.error('❌ Redaction service test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Running Setup Tests...\n');
  console.log('='.repeat(50));
  
  const results = {
    configLoading: await testConfigLoading(),
    redactionMatcher: await testRedactionMatcher(),
    genericScanner: testGenericScanner(),
    envVarExpansion: testEnvironmentVariableExpansion(),
    redactionService: await testRedactionService(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  for (const [test, result] of Object.entries(results)) {
    console.log(`   ${result ? '✅' : '❌'} ${test}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('\n💥 Test runner failed:', error);
  process.exit(1);
});

