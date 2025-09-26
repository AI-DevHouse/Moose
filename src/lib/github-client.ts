// src/lib/github-client.ts
import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export interface CreatePROptions {
  title: string;
  body: string;
  head: string; // branch name
  base?: string; // defaults to 'main'
  draft?: boolean;
}

export interface CreateBranchOptions {
  branchName: string;
  fromBranch?: string; // defaults to 'main'
}

export interface CommitFileOptions {
  path: string;
  content: string;
  message: string;
  branch: string;
  sha?: string; // for updates
}

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      request: {
        timeout: 30000,
      },
    });
  }

  // Create a new branch
  async createBranch(options: CreateBranchOptions): Promise<void> {
    const { branchName, fromBranch = 'main' } = options;

    try {
      // Get the SHA of the base branch
      const { data: baseRef } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${fromBranch}`,
      });

      // Create new branch
      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });

      console.log(`Created branch: ${branchName} from ${fromBranch}`);
    } catch (error: any) {
      if (error.status === 422 && error.message.includes('already exists')) {
        console.log(`Branch ${branchName} already exists, skipping creation`);
        return;
      }
      throw new Error(`Failed to create branch ${branchName}: ${error.message}`);
    }
  }

  // Commit a file to a branch
  async commitFile(options: CommitFileOptions): Promise<string> {
    const { path, content, message, branch, sha } = options;

    try {
      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha && { sha }),
      });

      console.log(`Committed file ${path} to branch ${branch}`);
      return response.data.content?.sha || '';
    } catch (error: any) {
      throw new Error(`Failed to commit file ${path}: ${error.message}`);
    }
  }

  // Get file content and SHA (needed for updates)
  async getFile(path: string, branch = 'main'): Promise<{ content: string; sha: string } | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: branch,
      });

      if (Array.isArray(response.data) || response.data.type !== 'file') {
        return null;
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return {
        content,
        sha: response.data.sha,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null; // File doesn't exist
      }
      throw new Error(`Failed to get file ${path}: ${error.message}`);
    }
  }

  // Create a Pull Request
  async createPR(options: CreatePROptions): Promise<{ number: number; url: string }> {
    const { title, body, head, base = 'main', draft = false } = options;

    try {
      const response = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title,
        body,
        head,
        base,
        draft,
      });

      console.log(`Created PR #${response.data.number}: ${title}`);
      return {
        number: response.data.number,
        url: response.data.html_url,
      };
    } catch (error: any) {
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  // Add labels to a PR
  async addLabelsToIssue(issueNumber: number, labels: string[]): Promise<void> {
    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        labels,
      });

      console.log(`Added labels ${labels.join(', ')} to PR #${issueNumber}`);
    } catch (error: any) {
      throw new Error(`Failed to add labels to PR #${issueNumber}: ${error.message}`);
    }
  }

  // Get repository info
  async getRepository(): Promise<any> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }

  // List open PRs
  async getOpenPRs(): Promise<any[]> {
    try {
      const response = await this.octokit.rest.pulls.list({
        owner: this.config.owner,
        repo: this.config.repo,
        state: 'open',
        per_page: 50,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get open PRs: ${error.message}`);
    }
  }

  // Get PR status checks
  async getPRChecks(prNumber: number): Promise<any> {
    try {
      // Get the PR to get the head SHA
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
      });

      // Get status checks for the head commit
      const response = await this.octokit.rest.checks.listForRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: pr.head.sha,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get PR checks for #${prNumber}: ${error.message}`);
    }
  }

  // Merge a PR
  async mergePR(prNumber: number, commitTitle?: string): Promise<void> {
    try {
      await this.octokit.rest.pulls.merge({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
        commit_title: commitTitle,
        merge_method: 'squash',
      });

      console.log(`Merged PR #${prNumber}`);
    } catch (error: any) {
      throw new Error(`Failed to merge PR #${prNumber}: ${error.message}`);
    }
  }

  // Delete a branch
  async deleteBranch(branchName: string): Promise<void> {
    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${branchName}`,
      });

      console.log(`Deleted branch: ${branchName}`);
    } catch (error: any) {
      if (error.status === 422) {
        console.log(`Branch ${branchName} doesn't exist or already deleted`);
        return;
      }
      throw new Error(`Failed to delete branch ${branchName}: ${error.message}`);
    }
  }

  // Test API connection
  async testConnection(): Promise<{ success: boolean; user: string; rateLimit: any }> {
    try {
      const [userResponse, rateLimitResponse] = await Promise.all([
        this.octokit.rest.users.getAuthenticated(),
        this.octokit.rest.rateLimit.get(),
      ]);

      return {
        success: true,
        user: userResponse.data.login,
        rateLimit: rateLimitResponse.data.rate,
      };
    } catch (error: any) {
      throw new Error(`GitHub API connection failed: ${error.message}`);
    }
  }
}

// Factory function to create GitHub client instance
export function createGitHubClient(): GitHubClient {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
  }

  // Extract owner and repo from the repository URL or use defaults
  const owner = 'AI-DevHouse'; // Your GitHub username/org
  const repo = 'Moose';

  return new GitHubClient({ owner, repo, token });
}