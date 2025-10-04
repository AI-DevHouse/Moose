export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/architect/decompose/route.ts
import { NextRequest, NextResponse} from 'next/server';
import { architectService } from '@/lib/architect-service';
import type { TechnicalSpec } from '@/types/architect';
import { withRateLimit, architectApiLimiter } from '@/lib/rate-limiter';
import { validateTechnicalSpec, securityCheck } from '@/lib/input-sanitizer';

export async function POST(request: NextRequest) {
  // Apply rate limiting (4 req/min - Claude Sonnet 4.5 TPM limit: 30k TPM / 7.5k tokens)
  return withRateLimit(request, architectApiLimiter, async () => {
    try {
      const body = await request.json();

      // Validate and sanitize input
      const spec = validateTechnicalSpec(body);

      // Security check on feature_name
      const secCheck = securityCheck(spec.feature_name);
      if (!secCheck.safe) {
        return NextResponse.json({
          success: false,
          error: `Security threat detected: ${secCheck.threats.join(', ')}`,
        }, { status: 400 });
      }

      const decomposition = await architectService.decomposeSpec(spec as TechnicalSpec);

      return NextResponse.json({
        success: true,
        data: decomposition
      });

    } catch (error: any) {
      console.error('Architect decompose error:', error);

      // Check if validation error
      if (error.message.includes('required') || error.message.includes('must be')) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: 'Internal server error'
      }, { status: 500 });
    }
  });
}