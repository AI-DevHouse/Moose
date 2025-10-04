export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { systemStatusService } from '@/lib/api-client'

export async function GET() {
  return systemStatusService.getAll()
}






