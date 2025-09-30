// src/app/api/architect/decompose/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { architectService } from '@/lib/architect-service';
import type { TechnicalSpec } from '@/types/architect';

export async function POST(request: NextRequest) {
  try {
    const spec: TechnicalSpec = await request.json();

    // Validate structure
    if (!spec.feature_name || !spec.objectives || !spec.constraints || !spec.acceptance_criteria) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: feature_name, objectives, constraints, acceptance_criteria'
      }, { status: 400 });
    }

    const decomposition = await architectService.decomposeSpec(spec);

    return NextResponse.json({
      success: true,
      data: decomposition
    });

  } catch (error: any) {
    console.error('Architect decompose error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}