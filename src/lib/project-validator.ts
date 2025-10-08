// Project Validator - Validates project state before execution

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { projectService } from './project-service';
import type { Project } from './project-service';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export class ProjectValidator {

  /**
   * Validate project is in good state before executing work orders
   *
   * Checks:
   * - Directory exists
   * - Git is initialized
   * - GitHub remote is configured (if linked)
   * - No uncommitted changes (optional - for clean state)
   *
   * @param projectId - Project UUID
   * @param options - Validation options
   * @returns Validation result
   */
  async validateProject(
    projectId: string,
    options?: {
      requireCleanWorkingDirectory?: boolean;
    }
  ): Promise<ValidationResult> {
    const issues: string[] = [];

    try {
      // Get project from database
      const project = await projectService.getProject(projectId);

      if (!project) {
        issues.push(`Project not found in database: ${projectId}`);
        return { valid: false, issues };
      }

      // Check 1: Directory exists
      if (!fs.existsSync(project.local_path)) {
        issues.push(`Directory not found: ${project.local_path}`);
        return { valid: false, issues };
      }

      // Check 2: Git initialized
      const gitDir = path.join(project.local_path, '.git');
      if (!fs.existsSync(gitDir)) {
        issues.push('Git not initialized in project directory');
        return { valid: false, issues };
      }

      // Check 3: GitHub remote configured (if linked)
      if (project.github_repo_name) {
        try {
          const remotes = execSync('git remote -v', {
            cwd: project.local_path,
            encoding: 'utf-8',
            stdio: 'pipe'
          });

          if (!remotes.includes('origin')) {
            issues.push('GitHub remote not configured (expected "origin")');
          } else {
            // Verify remote URL matches database
            if (!remotes.includes(project.github_repo_name)) {
              issues.push(
                `GitHub remote mismatch: expected ${project.github_repo_name}, ` +
                `but remote URL doesn't match`
              );
            }
          }
        } catch (error: any) {
          issues.push(`Failed to check git remotes: ${error.message}`);
        }
      }

      // Check 4: Clean working directory (optional)
      if (options?.requireCleanWorkingDirectory) {
        try {
          const status = execSync('git status --porcelain', {
            cwd: project.local_path,
            encoding: 'utf-8',
            stdio: 'pipe'
          });

          if (status.trim().length > 0) {
            issues.push(
              'Working directory has uncommitted changes. ' +
              'Commit or stash changes before executing work orders.'
            );
          }
        } catch (error: any) {
          issues.push(`Failed to check git status: ${error.message}`);
        }
      }

      // Check 5: Project status
      if (project.status === 'failed') {
        issues.push('Project status is "failed". Fix issues before executing work orders.');
      }

      if (project.status === 'archived') {
        issues.push('Project is archived. Unarchive before executing work orders.');
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error: any) {
      issues.push(`Validation error: ${error.message}`);
      return { valid: false, issues };
    }
  }

  /**
   * Validate and throw if invalid
   *
   * Convenience method that throws an error if validation fails
   *
   * @param projectId - Project UUID
   * @param options - Validation options
   * @throws Error if validation fails
   */
  async validateOrThrow(
    projectId: string,
    options?: {
      requireCleanWorkingDirectory?: boolean;
    }
  ): Promise<Project> {
    const validation = await this.validateProject(projectId, options);

    if (!validation.valid) {
      throw new Error(
        `Project validation failed:\n${validation.issues.map(i => `  - ${i}`).join('\n')}`
      );
    }

    // Return project for convenience
    const project = await projectService.getProject(projectId);
    return project!;
  }

  /**
   * Quick check if project directory exists
   *
   * @param projectId - Project UUID
   * @returns true if directory exists
   */
  async projectDirectoryExists(projectId: string): Promise<boolean> {
    const project = await projectService.getProject(projectId);
    if (!project) return false;
    return fs.existsSync(project.local_path);
  }

  /**
   * Get git status for project
   *
   * @param projectId - Project UUID
   * @returns Git status output or null if project not found
   */
  async getGitStatus(projectId: string): Promise<string | null> {
    const project = await projectService.getProject(projectId);
    if (!project || !fs.existsSync(project.local_path)) {
      return null;
    }

    try {
      const status = execSync('git status', {
        cwd: project.local_path,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      return status;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }
}

export const projectValidator = new ProjectValidator();
