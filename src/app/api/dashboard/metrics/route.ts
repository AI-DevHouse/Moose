export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { dashboardMetricsService } from '@/lib/api-client'

export async function GET() {
  return dashboardMetricsService.getAll()
}






