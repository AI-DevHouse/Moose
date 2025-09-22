import { patternMetricsService } from '@/lib/api-client'

export async function GET() {
  return patternMetricsService.getAll()
}






