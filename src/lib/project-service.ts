// Project Service - Manages target application projects

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Project type from database
export interface Project {
  id: string;
  name: string;
  local_path: string;
  github_repo_name: string | null;
  github_repo_url: string | null;
  github_org: string | null;
  supabase_project_url: string | null;
  supabase_anon_key: string | null;
  vercel_team_id: string | null;
  status: string;
  infrastructure_status: string;
  setup_notes: any | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectParams {
  name: string;
  local_path: string;
  github_org?: string;
  supabase_project_url?: string;
  supabase_anon_key?: string;
  vercel_team_id?: string;
  infrastructure_status?: string;
}

export interface ProjectValidationResult {
  valid: boolean;
  issues: string[];
}

export class ProjectService {

  /**
   * Create a new project with transaction rollback
   *
   * Steps:
   * 1. Validate local_path doesn't exist or is empty
   * 2. Create directory
   * 3. Initialize git repository
   * 4. Create initial commit
   * 5. Insert database record
   * 6. Rollback on any failure
   *
   * @param params - Project creation parameters
   * @returns Created project
   */
  async createProject(params: CreateProjectParams): Promise<Project> {
    try {
      // Note: Directory creation and git initialization are handled by the API route
      // This service focuses on database operations only
      console.log(`[ProjectService] Creating database record`);

      // Store in database
      const { data: project, error} = await (supabase as any)
        .from('projects')
        .insert({
          name: params.name,
          local_path: params.local_path,
          github_org: params.github_org || null,
          supabase_project_url: params.supabase_project_url || null,
          supabase_anon_key: params.supabase_anon_key || null,
          vercel_team_id: params.vercel_team_id || null,
          status: 'initialized',
          infrastructure_status: params.infrastructure_status || 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[ProjectService] Project created successfully: ${project.id}`);

      return project;

    } catch (error: any) {
      console.error('[ProjectService] Database creation failed:', error.message);
      // Note: Directory cleanup is handled by the API route if needed
      throw new Error(`Project creation failed: ${error.message}`);
    }
  }

  /**
   * Get project by ID
   *
   * @param projectId - Project UUID
   * @returns Project or null if not found
   */
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await (supabase as any)
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * List all projects with optional status filter
   *
   * @param status - Filter by status
   * @returns Array of projects
   */
  async listProjects(status?: Project['status']): Promise<Project[]> {
    let query = (supabase as any)
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  }

  /**
   * Link project to GitHub repository
   *
   * Adds git remote and updates database
   *
   * @param projectId - Project UUID
   * @param repoName - GitHub repo name (e.g., "user/todo-app")
   */
  async linkGitHub(projectId: string, repoName: string): Promise<void> {
    const project = await this.getProject(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (!fs.existsSync(project.local_path)) {
      throw new Error(`Project directory not found: ${project.local_path}`);
    }

    console.log(`[ProjectService] Linking GitHub repo: ${repoName}`);

    try {
      // Check if remote already exists
      try {
        const remotes = execSync('git remote', {
          cwd: project.local_path,
          encoding: 'utf-8'
        });

        if (remotes.includes('origin')) {
          console.log('[ProjectService] Remote origin already exists, removing...');
          execSync('git remote remove origin', {
            cwd: project.local_path,
            stdio: 'pipe'
          });
        }
      } catch (e) {
        // No remotes, that's fine
      }

      // Add remote
      execSync(`git remote add origin https://github.com/${repoName}.git`, {
        cwd: project.local_path,
        stdio: 'pipe'
      });

      console.log('[ProjectService] Remote added successfully');

      // Update database
      const { error } = await (supabase as any)
        .from('projects')
        .update({
          github_repo_name: repoName,
          github_repo_url: `https://github.com/${repoName}`,
          status: 'active'
        })
        .eq('id', projectId);

      if (error) throw error;

      console.log('[ProjectService] Database updated');

    } catch (error: any) {
      throw new Error(`Failed to link GitHub: ${error.message}`);
    }
  }

  /**
   * Update project status
   *
   * @param projectId - Project UUID
   * @param status - New status
   */
  async updateStatus(
    projectId: string,
    status: Project['status']
  ): Promise<void> {
    const { error } = await (supabase as any)
      .from('projects')
      .update({ status })
      .eq('id', projectId);

    if (error) throw error;
  }

  /**
   * Delete project (soft delete - marks as archived)
   *
   * @param projectId - Project UUID
   * @param hardDelete - If true, also delete files and database record
   */
  async deleteProject(
    projectId: string,
    options?: {
      deleteFiles?: boolean;
      deleteGitHubRepo?: boolean;
    }
  ): Promise<void> {
    const project = await this.getProject(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    console.log(`[ProjectService] Deleting project: ${project.name}`);

    // Soft delete by default (mark as archived)
    await this.updateStatus(projectId, 'archived');

    // Hard delete files if requested
    if (options?.deleteFiles && fs.existsSync(project.local_path)) {
      console.log(`[ProjectService] Deleting directory: ${project.local_path}`);
      fs.rmSync(project.local_path, { recursive: true, force: true });
    }

    // Delete GitHub repo if requested
    if (options?.deleteGitHubRepo && project.github_repo_name) {
      console.log(`[ProjectService] Deleting GitHub repo: ${project.github_repo_name}`);
      try {
        execSync(`gh repo delete ${project.github_repo_name} --yes`, {
          stdio: 'pipe'
        });
      } catch (error: any) {
        console.warn(`[ProjectService] Failed to delete GitHub repo: ${error.message}`);
      }
    }

    console.log('[ProjectService] Project deleted');
  }
}

export const projectService = new ProjectService();
