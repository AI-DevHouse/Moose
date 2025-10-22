// Create test work orders to validate dependency context fix
// These WOs test common scenarios that previously caused TS2307 errors

import { createSupabaseServiceClient } from '../src/lib/supabase';

const supabase = createSupabaseServiceClient();

async function createTestWorkOrders() {
  console.log('🧪 Creating Test Work Orders for Dependency Fix Validation\n');

  // Get the test project ID (moose-mission-control)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('name', 'moose-mission-control')
    .single();

  if (!project) {
    console.error('❌ Project "moose-mission-control" not found');
    process.exit(1);
  }

  const testSpecs = [
    {
      title: 'Create Supabase data fetcher utility',
      spec: `Create a TypeScript utility function that fetches all active work orders from Supabase.

Requirements:
- Use @supabase/supabase-js for database access
- Import Database type from @/types/supabase
- Return properly typed data
- Include error handling
- Export the function for reuse

File: src/lib/utils/fetch-work-orders.ts`,
      tags: ['test-dependency-fix', 'supabase', 'utility']
    },
    {
      title: 'Create date formatting helper',
      spec: `Create a TypeScript helper function that formats dates using date-fns library.

Requirements:
- Use date-fns package (installed in package.json)
- Format dates as "MMM dd, yyyy HH:mm"
- Handle null/undefined dates gracefully
- Export formatDate and formatRelativeTime functions

File: src/lib/utils/date-helpers.ts`,
      tags: ['test-dependency-fix', 'date-fns', 'utility']
    },
    {
      title: 'Create GitHub API wrapper',
      spec: `Create a TypeScript service that wraps GitHub API operations using Octokit.

Requirements:
- Use @octokit/rest package (installed)
- Create a class GitHubService with methods: createBranch, createPR
- Use environment variables for authentication
- Include TypeScript types from @octokit/rest

File: src/lib/services/github-service.ts`,
      tags: ['test-dependency-fix', 'github', 'octokit']
    },
    {
      title: 'Create React component with Heroicons',
      spec: `Create a React component that displays work order status with icons.

Requirements:
- Use @heroicons/react for status icons
- Use proper TypeScript types for props
- Include CheckCircleIcon, XCircleIcon, ClockIcon from heroicons
- Export StatusBadge component

File: src/components/StatusBadge.tsx`,
      tags: ['test-dependency-fix', 'react', 'heroicons']
    },
    {
      title: 'Create Zod validation schema',
      spec: `Create a Zod schema for validating work order creation requests.

Requirements:
- Use zod package (installed)
- Define schema for: title (string), spec (string), project_id (uuid)
- Export WorkOrderCreateSchema and infer TypeScript type
- Include validation for min/max lengths

File: src/lib/schemas/work-order-schema.ts`,
      tags: ['test-dependency-fix', 'zod', 'validation']
    }
  ];

  const createdWOs = [];

  for (const spec of testSpecs) {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .insert({
        project_id: project.id,
        title: spec.title,
        spec: spec.spec,
        status: 'pending_approval',
        tags: spec.tags,
        metadata: {
          test_type: 'dependency-fix-validation',
          created_by_script: 'test-dependency-fix-wos.ts'
        }
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to create WO "${spec.title}":`, error);
      continue;
    }

    createdWOs.push(wo);
    console.log(`✅ Created WO #${wo.id.substring(0, 8)}: ${spec.title}`);
  }

  console.log(`\n📊 Created ${createdWOs.length}/${testSpecs.length} test work orders`);
  console.log(`\n🎯 Next steps:`);
  console.log(`   1. Approve these WOs: npx tsx --env-file=.env.local scripts/approve-test-wos.ts`);
  console.log(`   2. Wait for execution to complete`);
  console.log(`   3. Check results: npx tsx --env-file=.env.local scripts/check-dependency-test-results.ts`);
  console.log(`\n💡 Expected outcome: <30% TS2307 errors (vs 100% in v99)\n`);
}

createTestWorkOrders().catch(console.error);
