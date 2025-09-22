// src/app/api/escalations/route.ts
import { NextRequest } from 'next/server'
import { escalationsService } from '@/lib/api-client'

export async function GET(request: NextRequest) {
  return escalationsService.getAll(request)
}

export async function POST(request: NextRequest) {
  return escalationsService.create(request)
}
