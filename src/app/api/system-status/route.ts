import { systemStatusService } from '@/lib/api-client'

export async function GET() {
  return systemStatusService.getAll()
}






