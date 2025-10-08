export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/projects/initialize - Create a new project with setup wizard

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/project-service';
import {
  generateEnvTemplate,
  generateGitignore,
  generateSetupInstructions,
  generateReadme
} from '@/lib/project-template-generator';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const {
      name,
      root_directory,
      github_org,
      supabase_project_url,
      supabase_anon_key,
      vercel_team_id
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'name is required and must be a string' },
        { status: 400 }
      );
    }

    if (!root_directory || typeof root_directory !== 'string') {
      return NextResponse.json(
        { error: 'root_directory is required and must be a string' },
        { status: 400 }
      );
    }

    // Construct local path
    const local_path = path.join(root_directory, name);

    // Create project directory if it doesn't exist
    if (!fs.existsSync(local_path)) {
      fs.mkdirSync(local_path, { recursive: true });
      console.log(`[API] Created directory: ${local_path}`);
    }

    // Generate template configuration
    const templateConfig = {
      projectName: name,
      localPath: local_path,
      githubOrg: github_org,
      supabaseUrl: supabase_project_url,
      supabaseAnonKey: supabase_anon_key,
      vercelTeamId: vercel_team_id
    };

    // Generate and write template files
    const files = {
      '.env.local.template': generateEnvTemplate(templateConfig),
      '.gitignore': generateGitignore(),
      'SETUP_INSTRUCTIONS.md': generateSetupInstructions(templateConfig),
      'README.md': generateReadme(templateConfig)
    };

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(local_path, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`[API] Generated: ${filename}`);
    }

    // Initialize git repository
    const { execSync } = require('child_process');
    try {
      execSync('git init', { cwd: local_path, stdio: 'ignore' });
      execSync('git add .', { cwd: local_path, stdio: 'ignore' });
      execSync('git commit -m "chore: Initialize project"', { cwd: local_path, stdio: 'ignore' });
      console.log('[API] Git repository initialized');
    } catch (gitError) {
      console.warn('[API] Git initialization failed:', gitError);
    }

    // Create project in database
    console.log(`[API] Creating project: ${name} at ${local_path}`);
    const project = await projectService.createProject({
      name,
      local_path,
      github_org,
      supabase_project_url,
      supabase_anon_key,
      vercel_team_id,
      infrastructure_status: 'pending'
    });

    console.log(`[API] Project created: ${project.id}`);

    // Generate setup checklist
    const setupChecklist = {
      status: 'pending',
      steps: [
        {
          step: 1,
          title: 'Create GitHub Repository',
          completed: false,
          command: `gh repo create ${github_org || '<your-org>'}/${name} --private`,
          description: 'Create a new GitHub repository for this project'
        },
        {
          step: 2,
          title: 'Add Git Remote',
          completed: false,
          command: `cd ${local_path} && git remote add origin https://github.com/${github_org || '<your-org>'}/${name}.git && git push -u origin main`,
          description: 'Connect your local repository to GitHub'
        },
        {
          step: 3,
          title: 'Create Supabase Project (Optional)',
          completed: !!supabase_project_url,
          url: 'https://supabase.com/dashboard',
          description: 'Create a new Supabase project if your app needs a database'
        },
        {
          step: 4,
          title: 'Configure Environment Variables',
          completed: false,
          command: `cd ${local_path} && cp .env.local.template .env.local`,
          description: 'Copy the template and fill in your credentials'
        },
        {
          step: 5,
          title: 'Setup Vercel (Optional)',
          completed: !!vercel_team_id,
          command: `cd ${local_path} && vercel link`,
          description: 'Link your project to Vercel for deployment'
        }
      ]
    };

    return NextResponse.json({
      success: true,
      project,
      message: `✅ Project created at ${local_path}`,
      next_steps: setupChecklist,
      files_generated: Object.keys(files),
      instructions_file: path.join(local_path, 'SETUP_INSTRUCTIONS.md')
    });

  } catch (error: any) {
    console.error('[API] Project initialization failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
