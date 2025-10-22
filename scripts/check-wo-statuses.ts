// Check what work orders exist and their statuses
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('🔍 Checking Work Order Statuses\n');

  // Get all work orders
  const { data: allWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`Total work orders: ${allWOs?.length || 0}\n`);

  if (!allWOs || allWOs.length === 0) {
    console.log('No work orders found');
    process.exit(0);
  }

  // Group by status
  const statusGroups = allWOs.reduce((acc, wo) => {
    const status = wo.status || 'unknown';
    if (!acc[status]) acc[status] = [];
    acc[status].push(wo);
    return acc;
  }, {} as Record<string, any[]>);

  console.log('Work Orders by Status:\n');
  Object.entries(statusGroups).forEach(([status, wos]) => {
    console.log(`  ${status.padEnd(20)}: ${wos.length} WOs`);
  });

  // Check for acceptance results
  console.log('\n\nChecking for Acceptance Results:\n');

  let withAcceptanceResults = 0;
  let withScores = 0;

  allWOs.forEach(wo => {
    const metadata = wo.metadata as any;
    if (metadata?.acceptance_result) {
      withAcceptanceResults++;
      if (metadata.acceptance_result.acceptance_score) {
        withScores++;
      }
    }
  });

  console.log(`  WOs with acceptance_result in metadata: ${withAcceptanceResults}`);
  console.log(`  WOs with acceptance_score: ${withScores}`);

  // Sample some metadata structures
  console.log('\n\nSample Metadata Structures (first 3 WOs):\n');
  allWOs.slice(0, 3).forEach((wo, idx) => {
    console.log(`${idx + 1}. ${wo.title.substring(0, 50)}...`);
    console.log(`   Status: ${wo.status}`);
    console.log(`   Metadata keys: ${Object.keys((wo.metadata as any) || {}).join(', ') || 'none'}`);
    if (wo.metadata) {
      const metadata = wo.metadata as any;
      if (metadata.acceptance_result) {
        console.log(`   Has acceptance_result: ${JSON.stringify(metadata.acceptance_result).substring(0, 100)}...`);
      }
    }
    console.log('');
  });
}

main().catch(console.error);
