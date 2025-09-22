// src/app/api/escalations/[id]/route.ts
import { NextRequest } from 'next/server'
import { escalationsService } from '@/lib/api-client'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return escalationsService.resolve(request, params.id)
}