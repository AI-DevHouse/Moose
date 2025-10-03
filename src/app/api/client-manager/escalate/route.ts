// src/app/api/client-manager/escalate/route.ts
// API endpoint for creating escalations

import { NextRequest, NextResponse } from 'next/server'
import { clientManagerService } from '@/lib/client-manager-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { work_order_id } = body

    if (!work_order_id) {
      return NextResponse.json(
        { error: 'work_order_id is required' },
        { status: 400 }
      )
    }

    const result = await clientManagerService.createEscalation(work_order_id)

    return NextResponse.json({
      success: true,
      escalation: result.escalation,
      recommendation: result.recommendation
    })
  } catch (error: any) {
    console.error('Error creating escalation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create escalation' },
      { status: 500 }
    )
  }
}
