export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { ContractValidator, type Contract, type ValidationResult, type DiffAnalysis } from '@/lib/contract-validator';

export async function POST(request: NextRequest) {
  try {
    const validator = new ContractValidator();
    const body = await request.json();

    // Handle different validation types
    switch (body.validation_type) {
      case 'contract_validation':
        return await handleContractValidation(validator, body);
      
      case 'repository_scan':
        return await handleRepositoryValidation(validator, body);
      
      case 'diff_analysis':
        return await handleDiffAnalysis(validator, body);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid validation_type. Expected: contract_validation, repository_scan, or diff_analysis'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Contract validation API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function handleContractValidation(
  validator: ContractValidator, 
  body: any
): Promise<NextResponse> {
  const { contract_data, existing_version } = body;

  if (!contract_data) {
    return NextResponse.json({
      success: false,
      error: 'contract_data is required for contract validation'
    }, { status: 400 });
  }

  const result = await validator.validateContract(contract_data, existing_version);

  // Log validation result to cost tracking
  await logValidationCost(result, 'contract_validation');

  return NextResponse.json({
    success: true,
    validation_type: 'contract_validation',
    result,
    timestamp: new Date().toISOString()
  });
}

async function handleRepositoryValidation(
  validator: ContractValidator,
  body: any
): Promise<NextResponse> {
  const { repository_name, changes } = body;

  if (!repository_name || !Array.isArray(changes)) {
    return NextResponse.json({
      success: false,
      error: 'repository_name and changes array are required for repository scan'
    }, { status: 400 });
  }

  const results = await validator.analyzeRepositoryChanges(repository_name, changes);

  // Log validation result to cost tracking
  await logValidationCost(results, 'repository_scan');

  return NextResponse.json({
    success: true,
    validation_type: 'repository_scan',
    repository_name,
    results,
    summary: {
      total_validations: results.length,
      breaking_changes_found: results.reduce((sum, r) => sum + r.breaking_changes.length, 0),
      high_risk_items: results.filter(r => r.risk_assessment.level === 'high' || r.risk_assessment.level === 'critical').length
    },
    timestamp: new Date().toISOString()
  });
}

async function handleDiffAnalysis(
  validator: ContractValidator,
  body: any
): Promise<NextResponse> {
  const { file_changes, repository_context } = body;

  if (!Array.isArray(file_changes)) {
    return NextResponse.json({
      success: false,
      error: 'file_changes array is required for diff analysis'
    }, { status: 400 });
  }

  // Convert file changes to DiffAnalysis format
  const diffAnalyses: DiffAnalysis[] = file_changes.map((change: any) => ({
    file_path: change.file_path || change.filename,
    change_type: change.change_type || (change.status === 'added' ? 'added' : 
                  change.status === 'removed' ? 'removed' : 'modified'),
    contract_impact: [], // Will be populated by validation
    complexity_score: calculateComplexityScore(change)
  }));

  const results = await validator.analyzeRepositoryChanges(
    repository_context?.repository_name || 'unknown',
    diffAnalyses
  );

  return NextResponse.json({
    success: true,
    validation_type: 'diff_analysis',
    results,
    analysis_summary: {
      files_analyzed: file_changes.length,
      contract_violations: results.length,
      risk_distribution: {
        low: results.filter(r => r.risk_assessment.level === 'low').length,
        medium: results.filter(r => r.risk_assessment.level === 'medium').length,
        high: results.filter(r => r.risk_assessment.level === 'high').length,
        critical: results.filter(r => r.risk_assessment.level === 'critical').length
      }
    },
    timestamp: new Date().toISOString()
  });
}

function calculateComplexityScore(change: any): number {
  let score = 0;
  
  // Base score by change type
  if (change.status === 'added') score += 2;
  if (change.status === 'modified') score += 1;
  if (change.status === 'removed') score += 3;
  
  // Additional complexity factors
  if (change.additions) score += Math.min(change.additions / 10, 5);
  if (change.deletions) score += Math.min(change.deletions / 10, 5);
  
  // File type multipliers
  if (change.filename?.endsWith('.ts') || change.filename?.endsWith('.js')) score *= 1.2;
  if (change.filename?.includes('api/') || change.filename?.includes('schema/')) score *= 1.5;
  
  return Math.min(score, 10); // Cap at 10
}

async function logValidationCost(
  result: ValidationResult | ValidationResult[],
  validationType: string
): Promise<void> {
  try {
    // Simple cost calculation based on validation complexity
    const baseValidationCost = 0.001; // $0.001 per validation
    const complexityMultiplier = Array.isArray(result) ? result.length : 1;
    const estimatedCost = baseValidationCost * complexityMultiplier;

    // Log to Supabase cost_tracking table
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/cost-tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_name: 'contract_validation',
        cost: estimatedCost,
        metadata: {
          validation_type: validationType,
          validation_count: Array.isArray(result) ? result.length : 1,
          timestamp: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      console.warn('Failed to log validation cost:', response.statusText);
    }
  } catch (error) {
    console.warn('Cost logging failed:', error);
    // Don't throw - cost logging failure shouldn't break validation
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint for contract validation service
  return NextResponse.json({
    success: true,
    service: 'contract_validation',
    status: 'operational',
    endpoints: {
      validate: 'POST /api/contracts/validate',
      health: 'GET /api/contracts/validate'
    },
    supported_validation_types: [
      'contract_validation',
      'repository_scan', 
      'diff_analysis'
    ],
    timestamp: new Date().toISOString()
  });
}