import { createSupabaseServiceClient } from '../src/lib/supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkTestWorkOrders() {
  const supabase = createSupabaseServiceClient();

  // First, get some completed WOs to see their structure and acceptance criteria
  console.log('Fetching sample completed WOs to analyze acceptance criteria...\n');

  const { data: completedWOs, error: completedError } = await supabase
    .from('work_orders')
    .select('id, title, description, acceptance_criteria, status, github_pr_url, github_branch')
    .eq('status', 'completed')
    .limit(5);

  if (completedError) {
    console.error('Error fetching completed WOs:', completedError.message);
  } else if (completedWOs && completedWOs.length > 0) {
    console.log(`Found ${completedWOs.length} completed WOs. Analyzing...\n`);
    completedWOs.forEach(wo => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`ID: ${wo.id.substring(0, 8)}...`);
      console.log(`Title: ${wo.title}`);
      console.log(`Status: ${wo.status}`);
      console.log(`Branch: ${wo.github_branch || 'None'}`);
      console.log(`PR URL: ${wo.github_pr_url || 'None'}`);
      console.log(`\nDescription (first 200 chars):`);
      console.log((wo.description || 'None').substring(0, 200));
      console.log(`\nAcceptance Criteria:`);
      const criteria = wo.acceptance_criteria;
      if (criteria) {
        console.log(JSON.stringify(criteria, null, 2));
        const criteriaStr = JSON.stringify(criteria).toLowerCase();
        if (criteriaStr.includes('test')) {
          console.log(`  ⚠️ Contains test-related criteria`);
        }
      } else {
        console.log('None');
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
  } else {
    console.log('⚠️  No completed WOs found\n');
  }

  // Also check if there are any WOs with "test" in title
  console.log('\n\nSearching for ALL WOs with "test" in title...\n');

  const { data: testWOs, error: searchError } = await supabase
    .from('work_orders')
    .select('id, title, acceptance_criteria, status, github_pr_url')
    .ilike('title', '%test%')
    .order('id', { ascending: true });

  if (searchError) {
    console.error('Error searching for test WOs:', searchError.message);
  } else {
    console.log(`Found ${testWOs.length} WOs with "test" in title:\n`);
    testWOs.forEach(wo => {
      console.log(`#${wo.id} [${wo.status}]: ${wo.title}`);
      console.log(`  PR: ${wo.github_pr_url || 'None'}`);
      if (wo.acceptance_criteria) {
        const criteriaStr = JSON.stringify(wo.acceptance_criteria).toLowerCase();
        if (criteriaStr.includes('test')) {
          console.log(`  ↳ Acceptance criteria also mentions tests`);
        }
      }
    });
  }
}

checkTestWorkOrders().catch(console.error);
