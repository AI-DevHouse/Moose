import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { SentinelService } from '@/lib/sentinel/sentinel-service';
import { WorkflowResult } from '@/types/sentinel';

export async function POST(request: NextRequest) {
  // 1. Verify GitHub webhook signature
  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();

  if (!signature) {
    return Response.json(
      { error: 'Missing signature' },
      { status: 401 }
    );
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Sentinel] GITHUB_WEBHOOK_SECRET not configured');
    return Response.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.warn('[Sentinel] Invalid webhook signature');
    return Response.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // 2. Parse payload
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    return Response.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  // 3. Extract workflow run data
  const workflowRun = payload.workflow_run;
  if (!workflowRun) {
    return Response.json(
      { error: 'Missing workflow_run in payload' },
      { status: 400 }
    );
  }

  // 4. Only process completed workflow runs
  if (workflowRun.status !== 'completed') {
    return Response.json({
      success: true,
      message: 'Workflow not completed yet, ignoring'
    });
  }

  // 5. Extract PR number from head_branch (format: feature/wo-XXXXXXXX-...)
  const branchName = workflowRun.head_branch;
  const prNumber = extractPRNumber(branchName);

  if (!prNumber) {
    console.warn(`[Sentinel] Could not extract PR number from branch: ${branchName}`);
    return Response.json({
      success: true,
      message: 'Not a WO branch, ignoring'
    });
  }

  console.log(`[Sentinel] Received workflow completion for PR #${prNumber}`);
  console.log(`  Workflow: ${workflowRun.name}`);
  console.log(`  Conclusion: ${workflowRun.conclusion}`);
  console.log(`  Branch: ${branchName}`);

  // 6. Call Sentinel service to analyze results
  try {
    const sentinelService = new SentinelService();

    const workflowResult: WorkflowResult = {
      workflow_name: workflowRun.name,
      conclusion: workflowRun.conclusion,
      run_id: workflowRun.id,
      run_url: workflowRun.html_url,
      completed_at: workflowRun.updated_at
    };

    // Extract work_order_id from branch name
    const woMatch = branchName.match(/^feature\/wo-([a-f0-9]{8})-/);
    const work_order_id = woMatch ? `wo-${woMatch[1]}` : '';

    const decision = await sentinelService.analyzeWorkOrder({
      work_order_id,
      github_pr_number: prNumber,
      workflow_results: [workflowResult]
    });

    return Response.json({
      success: true,
      pr_number: prNumber,
      work_order_id,
      decision: {
        verdict: decision.verdict,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        escalation_required: decision.escalation_required
      }
    });
  } catch (error) {
    console.error('[Sentinel] Error analyzing workflow:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function extractPRNumber(branchName: string): number | null {
  // Extract from format: feature/wo-XXXXXXXX-...
  const match = branchName.match(/^feature\/wo-([a-f0-9]{8})-/);
  if (!match) return null;

  // Convert first 8 chars of hex to approximate PR number
  // This is a placeholder - actual PR mapping will use database lookup
  return parseInt(match[1].substring(0, 6), 16) % 10000;
}
