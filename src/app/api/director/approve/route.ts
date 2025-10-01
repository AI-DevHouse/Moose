// src/app/api/director/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processApprovalRequest, DirectorApprovalRequest } from '@/lib/director-service';

export async function POST(request: NextRequest) {
  try {
    const body: DirectorApprovalRequest = await request.json();

    // Validate request
    if (!body.decomposition || !body.feature_name) {
      return NextResponse.json(
        { error: 'Missing required fields: decomposition, feature_name' },
        { status: 400 }
      );
    }

    if (!body.decomposition.work_orders || body.decomposition.work_orders.length === 0) {
      return NextResponse.json(
        { error: 'Decomposition must contain at least one work order' },
        { status: 400 }
      );
    }

    // Process approval
    const response = await processApprovalRequest(body);

    if (!response.success) {
      return NextResponse.json(
        { error: response.error || 'Approval processing failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Director approval endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
