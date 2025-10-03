// src/app/api/client-manager/execute/route.ts
// API endpoint for executing human decisions on escalations

import { NextRequest, NextResponse } from 'next/server'
import { clientManagerService } from '@/lib/client-manager-service'
import { EscalationDecision } from '@/types/client-manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const decision: EscalationDecision = {
      escalation_id: body.escalation_id,
      chosen_option_id: body.chosen_option_id,
      human_notes: body.human_notes,
      decided_by: body.decided_by || 'user',
      decided_at: new Date().toISOString()
    }

    if (!decision.escalation_id || !decision.chosen_option_id) {
      return NextResponse.json(
        { error: 'escalation_id and chosen_option_id are required' },
        { status: 400 }
      )
    }

    const result = await clientManagerService.executeDecision(decision)

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error: any) {
    console.error('Error executing decision:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute decision' },
      { status: 500 }
    )
  }
}
