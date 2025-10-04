export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { patternMetricsService } from '@/lib/api-client'

export async function GET() {
  return patternMetricsService.getAll()
}






