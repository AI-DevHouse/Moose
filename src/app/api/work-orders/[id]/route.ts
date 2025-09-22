import { NextRequest } from 'next/server'
import { workOrderService } from '@/lib/api-client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return workOrderService.update(request, params.id)
}






