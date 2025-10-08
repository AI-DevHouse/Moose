// E2E Test Script
import fs from 'fs';

async function testE2E() {
  console.log('=== E2E Test Starting ===\n');

  // Step 1: Create project
  const projectName = `e2e-test-${Date.now()}`;
  console.log('Step 1: Creating project:', projectName);
  const createResponse = await fetch('http://localhost:3000/api/projects/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: projectName,
      root_directory: 'C:\\dev'
    })
  });

  const createResult = await createResponse.json();
  console.log('Create Result:', JSON.stringify(createResult, null, 2));

  if (!createResult.success) {
    console.error('❌ Project creation failed:', createResult.error);
    return;
  }

  const projectId = createResult.project.id;
  console.log('✅ Project created with ID:', projectId);
  console.log('');

  // Step 2: Create a simple test spec
  console.log('Step 2: Creating test spec...');
  const spec = `# Todo App with AI Chat

Build a simple todo application with the following features:

## Core Features
1. Add, edit, and delete todos
2. Mark todos as complete/incomplete
3. Filter todos by status (all, active, completed)
4. Store todos in localStorage

## AI Integration
5. Add an AI chat assistant using OpenAI GPT-4o-mini
6. Users can ask the AI for help organizing their tasks
7. AI can suggest task priorities based on descriptions

## Styling
8. Clean, modern UI using Tailwind CSS
9. Responsive design for mobile and desktop

## Technical Requirements
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- OpenAI API for chat functionality
`;

  const specPath = `C:\\dev\\${projectName}\\SPEC.txt`;
  fs.writeFileSync(specPath, spec);
  console.log('✅ Spec created at:', specPath);
  console.log('');

  // Step 3: Decompose with requirement detection
  console.log('Step 3: Decomposing spec with requirement detection...');
  const decomposeResponse = await fetch('http://localhost:3000/api/architect/decompose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      feature_name: 'Todo App with AI Chat',
      objectives: [
        'Create a todo app with add/edit/delete functionality',
        'Integrate OpenAI GPT-4o-mini for AI chat assistant',
        'Implement localStorage for data persistence',
        'Build responsive UI with Tailwind CSS'
      ],
      constraints: [
        'Use Next.js 14 with App Router',
        'TypeScript only',
        'Must be mobile responsive'
      ],
      acceptance_criteria: [
        'Users can add, edit, and delete todos',
        'Todos persist across page refreshes',
        'AI chat assistant can suggest task priorities',
        'Clean, modern UI on mobile and desktop'
      ],
      max_work_orders: 5
    })
  });

  const decomposeResult = await decomposeResponse.json();
  console.log('Decompose Result:', JSON.stringify(decomposeResult, null, 2));

  if (!decomposeResult.success) {
    console.error('❌ Decomposition failed:', decomposeResult.error);
    return;
  }

  console.log('✅ Created', decomposeResult.work_orders_created, 'work orders');
  if (decomposeResult.detected_requirements) {
    console.log('✅ Detected Requirements:');
    decomposeResult.detected_requirements.forEach(req => {
      console.log(`  - ${req.service}: ${req.env_var}`);
    });
  }
  console.log('');

  console.log('=== E2E Test Complete ===');
  console.log('Next steps:');
  console.log(`1. Check C:\\dev\\${projectName}\\.env.local.template for detected requirements`);
  console.log('2. Verify work orders are linked to project:', projectId);
  console.log('3. Test SSE progress by executing a work order');
}

testE2E().catch(console.error);
