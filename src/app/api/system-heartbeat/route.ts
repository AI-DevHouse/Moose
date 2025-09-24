// src/app/api/system-heartbeat/route.ts - FIXED TO ACCEPT GET REQUESTS
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple heartbeat check - verify system is responding
    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      service: "Moose Mission Control",
      phase: "2.1.1",
      uptime: process.uptime()
    });
  } catch (error) {
    return NextResponse.json({
      status: "error", 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  // Keep POST support for backward compatibility
  return GET();
}