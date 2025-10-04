export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { workOrderService } from '@/lib/api-client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return workOrderService.getById(params.id)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return workOrderService.update(request, params.id)
}






