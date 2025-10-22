import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

async function createExtractionTestWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('🧪 Creating 5 Test Work Orders for Extraction Validation...\n')

  // Test WOs with varying complexity to test extraction at different scales
  const testWOs = [
    {
      title: '[EXTRACTION-TEST-1] Add input validation helper function',
      description: 'Create a utility function validateInput(data: unknown, schema: z.Schema) that validates input using Zod and returns typed result. Should handle errors gracefully.',
      acceptance_criteria: [
        'Function accepts unknown data and Zod schema',
        'Returns { success: true, data: T } or { success: false, errors: string[] }',
        'Includes TypeScript generics for type safety',
        'Has JSDoc comments'
      ],
      files_in_scope: ['src/lib/validation-helper.ts'],
      risk_level: 'low',
      complexity_score: 0.6
    },
    {
      title: '[EXTRACTION-TEST-2] Create date formatting utility',
      description: 'Build a formatDate(date: Date, format: string) function that formats dates with common patterns like "YYYY-MM-DD", "MM/DD/YYYY", "MMM DD, YYYY".',
      acceptance_criteria: [
        'Supports at least 3 date formats',
        'Returns formatted string',
        'Handles invalid dates gracefully',
        'Includes unit tests'
      ],
      files_in_scope: ['src/lib/date-utils.ts'],
      risk_level: 'low',
      complexity_score: 0.65
    },
    {
      title: '[EXTRACTION-TEST-3] Implement retry mechanism with exponential backoff',
      description: 'Create a retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions) function that retries failed async operations with exponential backoff.',
      acceptance_criteria: [
        'Configurable max retries and initial delay',
        'Exponential backoff between retries',
        'Returns result or throws after max retries',
        'TypeScript generic for return type'
      ],
      files_in_scope: ['src/lib/retry-utils.ts'],
      risk_level: 'medium',
      complexity_score: 0.75
    },
    {
      title: '[EXTRACTION-TEST-4] Add error boundary React component',
      description: 'Create an ErrorBoundary React component that catches errors in child components and displays fallback UI. Should log errors to console.',
      acceptance_criteria: [
        'Catches React errors using componentDidCatch',
        'Shows custom fallback UI on error',
        'Logs error details to console',
        'TypeScript typed with proper props'
      ],
      files_in_scope: ['src/components/ErrorBoundary.tsx'],
      risk_level: 'medium',
      complexity_score: 0.8
    },
    {
      title: '[EXTRACTION-TEST-5] Build async queue manager',
      description: 'Implement an AsyncQueue class that processes async tasks sequentially with configurable concurrency limit. Should support pause/resume and error handling.',
      acceptance_criteria: [
        'Class with add(), pause(), resume(), clear() methods',
        'Processes tasks with concurrency limit',
        'Handles task failures without stopping queue',
        'Emits events for task completion',
        'TypeScript generics for task result types'
      ],
      files_in_scope: ['src/lib/async-queue.ts'],
      risk_level: 'high',
      complexity_score: 0.9
    }
  ]

  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951' // multi-llm-discussion-v1

  const createdIds: string[] = []

  for (let i = 0; i < testWOs.length; i++) {
    const wo = testWOs[i]

    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        project_id: projectId,
        title: wo.title,
        description: wo.description,
        acceptance_criteria: wo.acceptance_criteria,
        files_in_scope: wo.files_in_scope,
        risk_level: wo.risk_level,
        status: 'pending',
        metadata: {
          complexity_score: wo.complexity_score,
          test_batch: 'extraction-validation-v1',
          test_date: new Date().toISOString()
        }
      })
      .select('id')
      .single()

    if (error) {
      console.error(`❌ Error creating WO ${i + 1}:`, error)
      continue
    }

    createdIds.push(data.id)
    console.log(`${i + 1}. ✅ ${data.id.substring(0, 8)}... - ${wo.title}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log(`✅ Created ${createdIds.length}/5 extraction test work orders`)
  console.log('   Next: Run approve-extraction-test-wos.ts to approve them')
  console.log('='.repeat(80))

  return createdIds
}

createExtractionTestWOs().catch(console.error)
