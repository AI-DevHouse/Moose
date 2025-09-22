// src/app/api/system-heartbeat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient()
    
    // Get all system components
    const { data: components, error: fetchError } = await supabase
      .from('system_status')
      .select('id, component_name, status')
    
    if (fetchError) throw fetchError
    
    const currentTime = new Date().toISOString()
    
    // Update heartbeat for all components with realistic response times
    for (const component of components) {
      const responseTime = component.status === 'online' 
        ? Math.floor(Math.random() * 300) + 50  // 50-350ms for online
        : component.status === 'degraded'
        ? Math.floor(Math.random() * 800) + 500 // 500-1300ms for degraded  
        : 0 // 0ms for offline
      
      const { error: updateError } = await supabase
        .from('system_status')
        .update({
          last_heartbeat: currentTime,
          response_time_ms: responseTime
        })
        .eq('id', component.id)
      
      if (updateError) throw updateError
    }
    
    return NextResponse.json({ 
      message: 'System heartbeats updated', 
      updated: components.length,
      timestamp: currentTime
    })
    
  } catch (error) {
    console.error('Error updating system heartbeats:', error)
    return NextResponse.json(
      { error: 'Failed to update system heartbeats' }, 
      { status: 500 }
    )
  }
}