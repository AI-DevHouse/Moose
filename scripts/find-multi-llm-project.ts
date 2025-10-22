// Find multi-llm-discussion-v1 project in database
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .or('name.ilike.%multi-llm%,local_path.ilike.%multi-llm%');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  if (!projects || projects.length === 0) {
    console.log('No multi-llm project found in database');
    process.exit(0);
  }

  console.log(`Found ${projects.length} project(s):\n`);
  projects.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Path: ${p.local_path}`);
    console.log(`Status: ${p.status}`);
    console.log('---');
  });
}

main();
