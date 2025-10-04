export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { budgetService } from '@/lib/api-client'

export async function GET() {
  return budgetService.getAll()
}






