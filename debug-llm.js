// Debug LLM Service - Step by step testing
// Run this in your project directory: node debug-llm.js

const baseUrl = 'http://localhost:3000';

async function debugLLMService() {
    console.log('🔍 Debug Testing Phase 2.1.1 LLM Service');
    console.log('=' .repeat(50));
    
    // Test 1: Basic server connectivity
    console.log('\n🌐 Test 1: Basic Server Connection');
    try {
        const response = await fetch(`${baseUrl}/api/system-heartbeat`);
        const data = await response.json();
        console.log('✅ Basic server connection: WORKING');
        console.log(`   Status: ${data.status}`);
        console.log(`   Timestamp: ${data.timestamp}`);
    } catch (error) {
        console.log('❌ Basic server connection: FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('   Check if dev server is really running on port 3000');
        return;
    }
    
    // Test 2: Check if LLM endpoint exists
    console.log('\n📡 Test 2: LLM Endpoint Check');
    try {
        const response = await fetch(`${baseUrl}/api/llm`, {
            method: 'GET'
        });
        
        console.log(`   Response Status: ${response.status}`);
        console.log(`   Response OK: ${response.ok}`);
        
        if (response.status === 404) {
            console.log('❌ LLM endpoint: NOT FOUND');
            console.log('   The /api/llm/route.ts file may not exist or have errors');
            return;
        }
        
        if (response.status === 500) {
            console.log('❌ LLM endpoint: SERVER ERROR');
            const errorText = await response.text();
            console.log(`   Error details: ${errorText}`);
            return;
        }
        
        const data = await response.json();
        console.log('✅ LLM endpoint: RESPONDING');
        console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
        
    } catch (error) {
        console.log('❌ LLM endpoint: FAILED');
        console.log(`   Error: ${error.message}`);
        console.log(`   This suggests the /api/llm/route.ts file has compilation errors`);
    }
    
    // Test 3: Check other API endpoints
    console.log('\n📋 Test 3: Other API Endpoints');
    const endpoints = [
        '/api/work-orders',
        '/api/escalations', 
        '/api/system-status'
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`);
            console.log(`   ${endpoint}: ${response.status} (${response.ok ? 'OK' : 'ERROR'})`);
        } catch (error) {
            console.log(`   ${endpoint}: FAILED (${error.message})`);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🔍 Debug Complete');
}

// Run the debug
debugLLMService().catch(console.error);