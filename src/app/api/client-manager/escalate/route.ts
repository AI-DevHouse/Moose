// src/app/api/client-manager/escalate/route.ts
// API endpoint for creating escalations (SECURED)

import { NextRequest, NextResponse } from 'next/server';
import { clientManagerService } from '@/lib/client-manager-service';
import { withRateLimit, internalApiLimiter, getClientIP } from '@/lib/rate-limiter';
import { sanitizeString, securityCheck } from '@/lib/input-sanitizer';

export async function POST(request: NextRequest) {
  // Apply rate limiting (1000 req/min - internal API, no LLM calls)
  return withRateLimit(request, internalApiLimiter, async () => {
    try {
      // Parse and validate input
      const body = await request.json();
      const { work_order_id } = body;

      // Type check
      if (typeof work_order_id !== 'string') {
        return NextResponse.json(
          { error: 'work_order_id must be a string' },
          { status: 400 }
        );
      }

      // Sanitize
      const cleanId = sanitizeString(work_order_id, 100);

      // UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(cleanId)) {
        return NextResponse.json(
          { error: 'Invalid work_order_id format (must be UUID)' },
          { status: 400 }
        );
      }

      // Security check
      const { safe, threats } = securityCheck(cleanId);
      if (!safe) {
        console.warn('[Security] Escalation API threat detected:', {
          threats,
          ip: getClientIP(request),
        });
        return NextResponse.json(
          { error: `Security threat detected: ${threats.join(', ')}` },
          { status: 400 }
        );
      }

      // Audit logging
      console.log('[Escalation Created]', {
        work_order_id: cleanId,
        ip: getClientIP(request),
        timestamp: new Date().toISOString(),
      });

      // Execute escalation
      const result = await clientManagerService.createEscalation(cleanId);

      return NextResponse.json({
        success: true,
        escalation: result.escalation,
        recommendation: result.recommendation,
      });

    } catch (error: any) {
      console.error('Error creating escalation:', error);

      // Generic error for production
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Failed to create escalation' },
          { status: 500 }
        );
      }

      // Detailed error for development
      return NextResponse.json(
        { error: error.message || 'Failed to create escalation' },
        { status: 500 }
      );
    }
  });
}
