import { dashboardMetricsService } from '@/lib/api-client'

export async function GET() {
  return dashboardMetricsService.getAll()
}






