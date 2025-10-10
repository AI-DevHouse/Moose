// Check work order and its project configuration

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const workOrderId = '8f8335d7-ce95-479f-baba-cb1f000ca533';

  console.log('🔍 Checking work order and project...\n');

  // Get work order
  const { data: wo, error: woError } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single();

  if (woError) {
    console.error('❌ Error fetching work order:', woError);
    return;
  }

  console.log('Work Order:');
  console.log('  ID:', wo.id);
  console.log('  Title:', wo.title);
  console.log('  Status:', wo.status);
  console.log('  Project ID:', wo.project_id);
  console.log('  Metadata:', JSON.stringify(wo.metadata, null, 2));
  console.log('');

  if (!wo.project_id) {
    console.log('❌ No project_id set on work order!');
    return;
  }

  // Get project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', wo.project_id)
    .single();

  if (projectError) {
    console.error('❌ Error fetching project:', projectError);
    return;
  }

  console.log('Project:');
  console.log('  ID:', project.id);
  console.log('  Name:', project.name);
  console.log('  Status:', project.status);
  console.log('  Local Path:', project.local_path);
  console.log('  GitHub Repo:', project.github_repo_name);
  console.log('  GitHub Org:', project.github_org);
  console.log('');

  // Check if local_path exists
  const fs = await import('fs');
  if (project.local_path) {
    const exists = fs.existsSync(project.local_path);
    console.log(`Local path exists: ${exists ? '✅ YES' : '❌ NO'}`);
    if (!exists) {
      console.log(`  Path: ${project.local_path}`);
    }
  } else {
    console.log('❌ local_path is NOT SET (null/undefined)');
  }
}

main();
