import { NextRequest } from 'next/server'
import { workOrderService } from '@/lib/api-client'

export async function GET(request: NextRequest) {
  return workOrderService.getAll(request)
}

export async function POST(request: NextRequest) {
  return workOrderService.create(request)
}






