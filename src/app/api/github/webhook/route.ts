import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { ContractValidator } from '@/lib/contract-validator';

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function processContractValidation(payload: any) {
  if (!payload.pull_request) {
    return null; // No PR data to validate
  }
  
  if (payload.action !== 'opened' && payload.action !== 'synchronize') {
    console.log(`Skipping contract validation for PR action: ${payload.action}`);
    return null; // Only validate PR opens and updates
  }

  try {
    const validator = new ContractValidator();
    const pr = payload.pull_request;
    
    // Get changed files from GitHub API
    const filesResponse = await fetch(`https://api.github.com/repos/${payload.repository.full_name}/pulls/${pr.number}/files`, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!filesResponse.ok) {
      console.warn('Failed to fetch PR files from GitHub API');
      return null;
    }

    const files = await filesResponse.json();
    
    // Convert to diff analysis format
    const diffAnalyses = files.map((file: any) => ({
      file_path: file.filename,
      change_type: file.status === 'added' ? 'added' : 
                  file.status === 'removed' ? 'removed' : 'modified',
      contract_impact: [],
      complexity_score: Math.min((file.additions || 0) + (file.deletions || 0), 10)
    }));

    // Perform contract validation
    const validationResults = await validator.analyzeRepositoryChanges(
      payload.repository.full_name,
      diffAnalyses
    );

    // Filter for violations
    const violations = validationResults.filter(result => 
      !result.valid || 
      result.risk_assessment.level === 'high' || 
      result.risk_assessment.level === 'critical'
    );

    if (violations.length > 0) {
      console.log(`Contract violations detected in PR #${pr.number}:`, {
        violation_count: violations.length,
        high_risk_count: violations.filter(v => v.risk_assessment.level === 'high').length,
        critical_risk_count: violations.filter(v => v.risk_assessment.level === 'critical').length
      });
    }

    return {
      violations_detected: violations.length > 0,
      violation_count: violations.length,
      files_analyzed: files.length,
      results: violations
    };

  } catch (error) {
    console.error('Contract validation failed:', error);
    return {
      validation_error: true,
      error_message: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

export async function POST(request: NextRequest) {
  console.log("WEBHOOK FUNCTION CALLED - THIS SHOULD ALWAYS APPEAR");
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    
    const githubEvent = request.headers.get('x-github-event');
    const githubDelivery = request.headers.get('x-github-delivery');
    const githubSignature = request.headers.get('x-hub-signature-256');
    
    console.log('\n=== GITHUB WEBHOOK RECEIVED ===');
    console.log(`Event: ${githubEvent}`);
    console.log(`Delivery ID: ${githubDelivery}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Signature: ${githubSignature ? 'Present' : 'Missing'}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('=== END WEBHOOK ===\n');
    
    // Process contract validation for PR events
    let contractValidation = null;
    if (githubEvent === 'pull_request') {
      contractValidation = await processContractValidation(payload);
    }
    
    // Log event to database
    if (payload.repository) {
      const { error } = await supabase
        .from('github_events')
        .insert({
          event_type: githubEvent || 'unknown',
          action: payload.action || 'unknown',
          repository_id: payload.repository.id || 0,
          repository_name: payload.repository.full_name || payload.repository.name,
          pr_number: payload.pull_request?.number || null,
          branch_name: payload.pull_request?.head?.ref || null,
          commit_sha: payload.pull_request?.head?.sha || null,
          status: contractValidation?.violations_detected ? 'contract_violations' : 'processed',
          event_data: {
            ...payload,
            contract_validation: contractValidation
          }
        });

      if (error) {
        console.error('Failed to log GitHub event:', error);
      } else {
        console.log('GitHub event logged to database successfully');
      }
    }
    
    switch (githubEvent) {
      case 'ping':
        console.log('✅ Webhook ping received - GitHub connection verified');
        return NextResponse.json({ 
          message: 'Webhook ping received successfully',
          timestamp: new Date().toISOString() 
        });
      case 'pull_request':
        console.log(`🔍 Pull request ${payload.action} - Contract validation: ${contractValidation ? 'completed' : 'skipped'}`);
        break;
      default:
        console.log(`ℹ️ Unhandled event type: ${githubEvent}`);
    }
    
    return NextResponse.json({ 
      received: true, 
      event: githubEvent,
      processed: true,
      contract_validation: contractValidation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Webhook processing failed', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    timestamp: new Date().toISOString(),
    ready: true
  });
}