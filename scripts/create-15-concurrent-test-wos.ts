import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function create15ConcurrentTestWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951' // multi-llm-discussion-v1

  // Get GPT-4o-mini proposer ID
  const { data: gptProposer } = await supabase
    .from('proposer_configs')
    .select('id')
    .eq('name', 'gpt-4o-mini')
    .single()

  const gptProposerId = gptProposer?.id || 'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940'

  console.log(`🧪 Creating 5 additional test work orders for 15-concurrent pool test...\n`)

  const workOrders = [
    {
      title: 'Add TypeScript strict mode configuration',
      description: `Enable TypeScript strict mode for better type safety.

Tasks:
- Update tsconfig.json with strict: true
- Fix any type errors that arise
- Document the change

This is a 15-concurrent pool validation test #11.`,
      risk_level: 'low',
      acceptance_criteria: [
        'TypeScript strict mode is enabled',
        'No type errors in codebase',
        'Change is documented'
      ],
      files_in_scope: ['tsconfig.json']
    },
    {
      title: 'Add code formatting with Prettier',
      description: `Set up Prettier for consistent code formatting.

Tasks:
- Add .prettierrc configuration
- Create .prettierignore
- Document formatting standards

This is a 15-concurrent pool validation test #12.`,
      risk_level: 'low',
      acceptance_criteria: [
        'Prettier config is added',
        'Ignore file is created',
        'Documentation is updated'
      ],
      files_in_scope: ['.prettierrc', '.prettierignore']
    },
    {
      title: 'Add npm scripts for common tasks',
      description: `Add helpful npm scripts to package.json.

Tasks:
- Add lint script
- Add format script
- Add test:watch script

This is a 15-concurrent pool validation test #13.`,
      risk_level: 'low',
      acceptance_criteria: [
        'Lint script is added',
        'Format script is added',
        'Test watch script is added'
      ],
      files_in_scope: ['package.json']
    },
    {
      title: 'Add CONTRIBUTING.md guide',
      description: `Create contribution guidelines for the project.

Tasks:
- Create CONTRIBUTING.md
- Document coding standards
- Explain PR process

This is a 15-concurrent pool validation test #14.`,
      risk_level: 'low',
      acceptance_criteria: [
        'CONTRIBUTING.md exists',
        'Coding standards are documented',
        'PR process is explained'
      ],
      files_in_scope: ['CONTRIBUTING.md']
    },
    {
      title: 'Add .editorconfig for consistent formatting',
      description: `Add .editorconfig for editor consistency.

Tasks:
- Create .editorconfig file
- Set indent style and size
- Configure line endings

This is a 15-concurrent pool validation test #15.`,
      risk_level: 'low',
      acceptance_criteria: [
        '.editorconfig exists',
        'Indent rules are configured',
        'Line ending rules are set'
      ],
      files_in_scope: ['.editorconfig']
    }
  ]

  const createdWOs = []

  for (let i = 0; i < workOrders.length; i++) {
    const wo = workOrders[i]
    console.log(`📝 Creating work order ${i + 1}/5: ${wo.title}`)

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
        test_number: i + 11,
        test_batch: '15-concurrent-v96'
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
  console.log(`✅ Successfully created ${createdWOs.length}/5 work orders`)
  console.log('='.repeat(60))
  console.log('\nWork Orders:')
  createdWOs.forEach((wo, i) => {
    console.log(`${i + 1}. ${wo.id} - ${wo.title}`)
  })
  console.log('\n🎯 Now we have 15 pending WOs for the concurrent test!')
}

create15ConcurrentTestWOs().catch(console.error)
