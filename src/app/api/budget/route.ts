import { budgetService } from '@/lib/api-client'

export async function GET() {
  return budgetService.getAll()
}






