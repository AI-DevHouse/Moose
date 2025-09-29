import { NextResponse } from 'next/server';
import { configService } from '@/lib/config-services';

// GET /api/config - Retrieve current budget configuration
export async function GET() {
  try {
    const limits = await configService.getBudgetLimits();
    
    return NextResponse.json({
      success: true,
      data: limits,
      cached: true, // ConfigService uses 5-minute cache
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Config API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/config - Update budget configuration with validation
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    // Extract budget limits from request
    const {
      daily_soft_cap,
      daily_hard_cap,
      emergency_kill,
      monthly_target,
      monthly_hard_cap
    } = body;

    // Validate all required fields present
    if (
      daily_soft_cap === undefined ||
      daily_hard_cap === undefined ||
      emergency_kill === undefined ||
      monthly_target === undefined ||
      monthly_hard_cap === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: [
            'daily_soft_cap',
            'daily_hard_cap',
            'emergency_kill',
            'monthly_target',
            'monthly_hard_cap'
          ]
        },
        { status: 400 }
      );
    }

    // Update via ConfigService (includes validation)
    const updatedLimits = await configService.updateBudgetLimits(
      {
        daily_soft_cap,
        daily_hard_cap,
        emergency_kill,
        monthly_target,
        monthly_hard_cap
      },
      'api_user' // In production, extract from auth token
    );

    return NextResponse.json({
      success: true,
      data: updatedLimits,
      message: 'Budget configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Config API] PUT error:', error);
    
    // Check if validation error from ConfigService
    if (error instanceof Error && error.message.includes('must be less than')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}