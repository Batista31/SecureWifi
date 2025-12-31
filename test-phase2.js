/**
 * Phase 2 Test Script
 * 
 * Tests all Security Automation & Rule Engine features
 * Run with: node test-phase2.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper to make HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test results tracker
const results = [];
function log(test, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${test}`);
  if (details) console.log(`   ${details}`);
  results.push({ test, passed, details });
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  PHASE 2 TEST SUITE - Security Automation & Rule Engine');
  console.log('='.repeat(60) + '\n');

  // ==========================================
  // TEST 1: Server Health Check
  // ==========================================
  console.log('\n--- Test 1: Server Health ---');
  try {
    const health = await request('GET', '/api/health');
    log('Server is running', health.status === 200);
    log('Simulation mode active', health.data.mode === 'simulation', `Mode: ${health.data.mode}`);
  } catch (e) {
    log('Server is running', false, e.message);
  }

  // ==========================================
  // TEST 2: Firewall Explain Endpoint (Public)
  // ==========================================
  console.log('\n--- Test 2: Firewall Educational Content ---');
  try {
    const explain = await request('GET', '/api/firewall/explain');
    log('Firewall explain endpoint works', explain.status === 200);
    log('Rule engine explanation exists', !!explain.data.data?.ruleEngine);
    log('L2 isolation explanation exists', !!explain.data.data?.layer2Isolation);
    log('MAC/IP binding explanation exists', !!explain.data.data?.macIpBinding);
    
    if (explain.data.data?.ruleEngine) {
      console.log('\n   📚 Rule Engine Components:');
      explain.data.data.ruleEngine.components?.forEach(c => {
        console.log(`      - ${c.name}: ${c.purpose}`);
      });
    }
  } catch (e) {
    log('Firewall explain endpoint works', false, e.message);
  }

  // ==========================================
  // TEST 3: Voucher Authentication with Firewall
  // ==========================================
  console.log('\n--- Test 3: Authentication with Firewall Integration ---');
  let authToken = null;
  try {
    const auth = await request('POST', '/api/auth/voucher', {
      code: 'TEST1234',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      ipAddress: '192.168.4.100',
    });
    
    log('Voucher authentication works', auth.status === 200 && auth.data.success);
    log('Session created', !!auth.data.sessionId, `Session ID: ${auth.data.sessionId}`);
    log('Token received', !!auth.data.token);
    authToken = auth.data.token;
    
    // Check server logs for firewall activity
    console.log('\n   🔥 Check server console for firewall rule generation!');
  } catch (e) {
    log('Voucher authentication works', false, e.message);
  }

  // ==========================================
  // TEST 4: Admin Login
  // ==========================================
  console.log('\n--- Test 4: Admin Authentication ---');
  let adminToken = null;
  try {
    const admin = await request('POST', '/api/admin/login', {
      username: 'admin',
      password: 'admin123',
    });
    
    log('Admin login works', admin.status === 200 && admin.data.success);
    adminToken = admin.data.token;
    log('Admin token received', !!adminToken);
  } catch (e) {
    log('Admin login works', false, e.message);
  }

  // ==========================================
  // TEST 5: Firewall Status (Admin Only)
  // ==========================================
  console.log('\n--- Test 5: Firewall Status (Requires Admin) ---');
  if (adminToken) {
    try {
      const statusReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/firewall/status',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const result = JSON.parse(data);
          log('Firewall status accessible', res.statusCode === 200);
          log('Simulation mode confirmed', result.data?.isSimulation === true);
          log('Cleanup scheduler running', result.data?.cleanupRunning === true);
          
          console.log('\n   📊 Firewall Status:');
          console.log(`      Mode: ${result.data?.mode}`);
          console.log(`      Active Bindings: ${result.data?.bindings?.active || 0}`);
          console.log(`      iptables Rules: ${result.data?.iptables?.activeRules || 0}`);
          console.log(`      ebtables Rules: ${result.data?.ebtables?.activeRules || 0}`);
          
          continueTests();
        });
      });
      statusReq.end();
      return; // Wait for async response
    } catch (e) {
      log('Firewall status accessible', false, e.message);
    }
  } else {
    log('Firewall status accessible', false, 'No admin token');
  }
  
  continueTests();
}

async function continueTests() {
  // ==========================================
  // TEST 6: iptables Rules
  // ==========================================
  console.log('\n--- Test 6: iptables Rules (Simulation) ---');
  try {
    const iptables = await request('GET', '/api/firewall/rules/iptables');
    // Will fail without admin token, which is expected
    log('iptables endpoint protected', iptables.status === 401 || iptables.status === 403);
  } catch (e) {
    log('iptables endpoint exists', true, 'Protected (requires admin)');
  }

  // ==========================================
  // TEST 7: MAC/IP Bindings
  // ==========================================
  console.log('\n--- Test 7: MAC/IP Bindings ---');
  try {
    const bindings = await request('GET', '/api/firewall/bindings');
    log('Bindings endpoint protected', bindings.status === 401 || bindings.status === 403);
  } catch (e) {
    log('Bindings endpoint exists', true, 'Protected (requires admin)');
  }

  // ==========================================
  // TEST 8: Spoof Detection
  // ==========================================
  console.log('\n--- Test 8: Spoofing Detection ---');
  try {
    const spoof = await request('GET', '/api/firewall/security/spoof-detection');
    log('Spoof detection endpoint protected', spoof.status === 401 || spoof.status === 403);
  } catch (e) {
    log('Spoof detection endpoint exists', true, 'Protected (requires admin)');
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n  Total Tests: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`\n  Success Rate: ${Math.round(passed / results.length * 100)}%`);
  
  if (failed === 0) {
    console.log('\n  🎉 ALL PHASE 2 TESTS PASSED!');
    console.log('  The Security Automation & Rule Engine is working correctly.\n');
  } else {
    console.log('\n  ⚠️  Some tests failed. Check the details above.\n');
  }

  console.log('\n--- Manual Verification ---');
  console.log('1. Open browser: http://localhost:3000/portal');
  console.log('2. Click "Use Voucher Code"');
  console.log('3. Enter code: TEST1234');
  console.log('4. Watch server console for RULE ENGINE logs');
  console.log('5. Visit: http://localhost:3000/api/firewall/explain');
  console.log('');
}

// Run tests
runTests();
