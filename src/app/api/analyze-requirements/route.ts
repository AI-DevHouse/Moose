export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/analyze-requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirementAnalyzer } from '@/lib/requirement-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const spec = body.spec || body.technical_spec || body;

    if (!spec) {
      return NextResponse.json({
        success: false,
        error: 'spec or technical_spec is required'
      }, { status: 400 });
    }

    // Analyze spec for external dependencies
    const requirements = await requirementAnalyzer.analyzeSpec(spec);

    return NextResponse.json({
      success: true,
      requirements,
      count: requirements.length
    });

  } catch (error: any) {
    console.error('Requirement analysis error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
