import { createSupabaseServiceClient } from '../src/lib/supabase';

async function checkProjects() {
  const supabase = createSupabaseServiceClient();

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📁 Projects in database:\n');
  projects?.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`Local Path: ${p.local_path}`);
    console.log(`Repo URL: ${p.repo_url}`);
    console.log(`Owner: ${p.repo_owner}`);
    console.log('');
  });
}

checkProjects().catch(console.error);
