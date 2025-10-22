import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function createWorktreeTestWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951' // multi-llm-discussion-v1

  // Get GPT-4o-mini proposer ID
  const { data: gptProposer } = await supabase
    .from('proposer_configs')
    .select('id')
    .eq('name', 'gpt-4o-mini')
    .single()

  const gptProposerId = gptProposer?.id || 'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940'

  console.log(`🧪 Creating 3 test work orders for worktree pool validation...\n`)

  const workOrders = [
    {
      title: 'Add improved error handling to API endpoints',
      description: `Enhance error handling in the API endpoints to provide more detailed error messages and proper status codes.

Tasks:
- Add try-catch blocks to all API endpoints
- Return proper HTTP status codes (400, 404, 500)
- Log errors with context for debugging

This is a worktree pool validation test #1.`,
      risk_level: 'low',
      acceptance_criteria: [
        'All API endpoints have error handling',
        'Proper HTTP status codes are returned',
        'Error logs include context'
      ],
      files_in_scope: ['src/pages/api/**/*.ts']
    },
    {
      title: 'Update README with project architecture overview',
      description: `Add a comprehensive architecture overview section to README.md explaining the system design.

Tasks:
- Create "Architecture" section
- Document key components (proposers, orchestrator, validators)
- Include flow diagrams if possible

This is a worktree pool validation test #2.`,
      risk_level: 'low',
      acceptance_criteria: [
        'README.md contains Architecture section',
        'Key components are documented',
        'Flow is explained clearly'
      ],
      files_in_scope: ['README.md', 'docs/**/*.md']
    },
    {
      title: 'Add input validation to environment variables',
      description: `Implement validation for environment variables to catch configuration errors early.

Tasks:
- Create validation function for required env vars
- Check data types and formats
- Throw clear errors on startup if invalid

This is a worktree pool validation test #3.`,
      risk_level: 'low',
      acceptance_criteria: [
        'Environment variables are validated on startup',
        'Clear error messages for invalid config',
        'All required variables are checked'
      ],
      files_in_scope: ['src/lib/config.ts', 'src/lib/env.ts']
    }
  ]

  const createdWOs = []

  for (let i = 0; i < workOrders.length; i++) {
    const wo = workOrders[i]
    console.log(`📝 Creating work order ${i + 1}/3: ${wo.title}`)

    const workOrderData = {
      ...wo,
      project_id: projectId,
      status: 'pending',
      proposer_id: gptProposerId,
      estimated_cost: 0.05,
      pattern_confidence: 0.9,
      context_budget_estimate: 2000,
      metadata: {
        auto_approved: true,
        test_work_order: true,
        worktree_pool_test: true,
        test_number: i + 1,
        test_batch: 'worktree-validation-v90'
      }
    }

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert(workOrderData)
      .select()
      .single()

    if (error) {
      console.error(`❌ Error creating work order ${i + 1}:`, error)
      continue
    }

    console.log(`   ✅ Created: ${workOrder.id}`)
    createdWOs.push(workOrder)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Successfully created ${createdWOs.length}/3 work orders`)
  console.log('='.repeat(60))
  console.log('\nWork Orders:')
  createdWOs.forEach((wo, i) => {
    console.log(`${i + 1}. ${wo.id} - ${wo.title}`)
  })
  console.log('\n🎯 Ready for orchestrator!')
  console.log('   Run: npm run orchestrator')
  console.log('\n📊 Monitor worktree pool lease/release cycle in logs')
}

createWorktreeTestWOs().catch(console.error)
