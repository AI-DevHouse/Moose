import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('github_events')
      .insert({
        event_type: body.event_type,
        action: body.action,
        repository_id: body.repository_id,
        repository_name: body.repository_name,
        pr_number: body.pr_number || null,
        branch_name: body.branch_name || null,
        commit_sha: body.commit_sha || null,
        workflow_name: body.workflow_name || null,
        check_name: body.check_name || null,
        status: body.status || null,
        conclusion: body.conclusion || null,
        event_data: body.event_data || null
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert GitHub event:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('GitHub events API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const eventType = searchParams.get('event_type');

    let query = supabase
      .from('github_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      events: data,
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('GitHub events fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}