export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/project-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await projectService.getProject(params.id);

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 });
    }

    return NextResponse.json(project);

  } catch (error: any) {
    console.error('Get project error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
