// LLM Service Testing Script for Phase 2.1.1
// Run this in your project directory: node llm-test.js

const baseUrl = 'http://localhost:3000';

async function testLLMService() {
    console.log('🚀 Testing Phase 2.1.1 LLM Service Implementation');
    console.log('=' .repeat(60));
    
    // Test 1: Service Status (GET /api/llm)
    console.log('\n📊 Test 1: Service Status Check');
    try {
        const statusResponse = await fetch(`${baseUrl}/api/llm`);
        const statusData = await statusResponse.json();
        
        if (statusResponse.ok) {
            console.log('✅ Service Status: OPERATIONAL');
            console.log(`   Providers: ${statusData.providers?.map(p => p.name).join(', ')}`);
            console.log(`   Mock Mode: ${statusData.mockMode ? 'ON' : 'OFF'}`);
            console.log(`   Rate Limits: ${JSON.stringify(statusData.rateLimits, null, 2)}`);
        } else {
            console.log('❌ Service Status: FAILED');
            console.log(`   Error: ${statusData.error}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Service Status: CONNECTION FAILED');
        console.log(`   Error: ${error.message}`);
        console.log('   Make sure your Next.js dev server is running: npm run dev');
        return false;
    }
    
    // Test 2: Connection Test (POST /api/llm)
    console.log('\n🔌 Test 2: API Connection Test');
    try {
        const connectionResponse = await fetch(`${baseUrl}/api/llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test_connection' })
        });
        
        const connectionData = await connectionResponse.json();
        
        if (connectionResponse.ok) {
            console.log('✅ Connection Test: PASSED');
            console.log(`   Anthropic: ${connectionData.results.anthropic}`);
            console.log(`   OpenAI: ${connectionData.results.openai}`);
            console.log(`   Cost: $${connectionData.metadata.cost}`);
        } else {
            console.log('❌ Connection Test: FAILED');
            console.log(`   Error: ${connectionData.error}`);
        }
    } catch (error) {
        console.log('❌ Connection Test: REQUEST FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Work Order Generation
    console.log('\n📋 Test 3: Work Order Generation');
    try {
        const workOrderResponse = await fetch(`${baseUrl}/api/llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generate_work_order',
                userRequest: 'Create a simple REST API endpoint for getting user profile information',
                userId: 'test-user-123',
                context: {
                    currentRepository: 'AI-DevHouse/Moose',
                    availableContracts: []
                }
            })
        });
        
        const workOrderData = await workOrderResponse.json();
        
        if (workOrderResponse.ok) {
            console.log('✅ Work Order Generation: SUCCESS');
            console.log(`   Title: ${workOrderData.workOrder?.title}`);
            console.log(`   Complexity: ${workOrderData.workOrder?.complexity_score}`);
            console.log(`   Selected Provider: ${workOrderData.workOrder?.selected_proposer}`);
            console.log(`   Tasks Count: ${workOrderData.workOrder?.acceptance_criteria?.length || 0}`);
            console.log(`   Cost: $${workOrderData.metadata.cost}`);
        } else {
            console.log('❌ Work Order Generation: FAILED');
            console.log(`   Error: ${workOrderData.error}`);
        }
    } catch (error) {
        console.log('❌ Work Order Generation: REQUEST FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 4: Contract Validation (Foundation Test)
    console.log('\n🔍 Test 4: Contract Validation Foundation');
    try {
        const contractResponse = await fetch(`${baseUrl}/api/llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'validate_contracts',
                changedFiles: [
                    {
                        path: 'src/api/users.ts',
                        content: 'export interface User { id: string; name: string; }'
                    }
                ],
                contracts: [
                    {
                        type: 'api',
                        path: 'src/api/users.ts',
                        definition: 'export interface User { id: string; name: string; email: string; }'
                    }
                ]
            })
        });
        
        const contractData = await contractResponse.json();
        
        if (contractResponse.ok) {
            console.log('✅ Contract Validation: SUCCESS');
            console.log(`   Breaking Changes: ${contractData.validation?.breaking_changes?.length || 0}`);
            console.log(`   Risk Level: ${contractData.validation?.risk_level}`);
            console.log(`   Cost: $${contractData.metadata.cost}`);
        } else {
            console.log('❌ Contract Validation: FAILED');
            console.log(`   Error: ${contractData.error}`);
        }
    } catch (error) {
        console.log('❌ Contract Validation: REQUEST FAILED');
        console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Testing Complete');
    console.log('Next: If all tests passed, ready for Phase 2.1.2 Contract Validation Engine');
    console.log('If any tests failed, check the error messages above');
}

// Run the tests
testLLMService().catch(console.error);
