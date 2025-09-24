// src/app/api/github/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createGitHubClient } from '@/lib/github-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Test GitHub connection and get repository info
export async function GET() {
  try {
    const githubClient = createGitHubClient();
    
    // Test connection and get basic info
    const connectionTest = await githubClient.testConnection();
    const repositoryInfo = await githubClient.getRepository();
    const openPRs = await githubClient.getOpenPRs();

    // Update system status
    await supabase
      .from('system_status')
      .upsert({
        component_name: 'github-integration',
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        response_time_ms: 0,
        metadata: {
          user: connectionTest.user,
          rate_limit: connectionTest.rateLimit,
          repository: repositoryInfo.full_name,
          open_prs: openPRs.length
        }
      }, { onConflict: 'component_name' });

    return NextResponse.json({
      success: true,
      connection: connectionTest,
      repository: {
        name: repositoryInfo.full_name,
        private: repositoryInfo.private,
        default_branch: repositoryInfo.default_branch,
        html_url: repositoryInfo.html_url
      },
      open_prs: openPRs.length,
      rate_limit: connectionTest.rateLimit
    });

  } catch (error: any) {
    console.error('GitHub API error:', error);

    // Update system status to degraded
    await supabase
      .from('system_status')
      .upsert({
        component_name: 'github-integration',
        status: 'degraded',
        last_heartbeat: new Date().toISOString(),
        response_time_ms: 0,
        metadata: { error: error.message }
      }, { onConflict: 'component_name' });

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST - Create a test PR or branch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...options } = body;

    const githubClient = createGitHubClient();

    switch (action) {
      case 'create_branch': {
        const { branchName, fromBranch } = options;
        await githubClient.createBranch({ branchName, fromBranch });
        
        return NextResponse.json({
          success: true,
          message: `Branch ${branchName} created successfully`,
          branch: branchName
        });
      }

      case 'create_pr': {
        const { title, body, head, base, draft } = options;
        const pr = await githubClient.createPR({ title, body, head, base, draft });
        
        return NextResponse.json({
          success: true,
          message: `PR #${pr.number} created successfully`,
          pr: pr
        });
      }

      case 'commit_file': {
        const { path, content, message, branch } = options;
        
        // Check if file exists (for updates)
        const existingFile = await githubClient.getFile(path, branch);
        
        const sha = await githubClient.commitFile({
          path,
          content,
          message,
          branch,
          sha: existingFile?.sha
        });

        return NextResponse.json({
          success: true,
          message: `File ${path} committed to ${branch}`,
          sha
        });
      }

      case 'test_workflow': {
        // Create a simple test workflow
        const workflowContent = `name: Mission Control Test
on:
  workflow_dispatch:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - run: npm ci
    - run: npm run build
    - run: echo "Mission Control test completed successfully"
`;

        const sha = await githubClient.commitFile({
          path: '.github/workflows/mission-control-test.yml',
          content: workflowContent,
          message: 'Add Mission Control test workflow',
          branch: options.branch || 'main'
        });

        return NextResponse.json({
          success: true,
          message: 'Test workflow created successfully',
          sha
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('GitHub operation error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}