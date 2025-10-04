export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/client-manager/resolutions/[id]/route.ts
// API endpoint for getting escalation resolutions

import { NextRequest, NextResponse } from 'next/server'
import { clientManagerService } from '@/lib/client-manager-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const escalationId = params.id

    const result = await clientManagerService.getEscalation(escalationId)

    return NextResponse.json({
      success: true,
      escalation: result.escalation,
      recommendation: result.recommendation
    })
  } catch (error: any) {
    console.error('Error fetching escalation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch escalation' },
      { status: 500 }
    )
  }
}
