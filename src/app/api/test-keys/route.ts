// src/app/api/test-keys/route.ts
// Development-only endpoint to verify API keys

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Only enable in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Test Anthropic connection
    let anthropicStatus = 'NOT_CONFIGURED';
    if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
      try {
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          anthropicStatus = 'CONNECTED';
        } else {
          const error = await anthropicResponse.text();
          anthropicStatus = `ERROR: ${anthropicResponse.status} - ${error.substring(0, 200)}`;
        }
      } catch (error) {
        anthropicStatus = `CONNECTION_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    // Test OpenAI connection
    let openaiStatus = 'NOT_CONFIGURED';
    if (openaiKey && openaiKey.startsWith('sk-')) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (openaiResponse.ok) {
          openaiStatus = 'CONNECTED';
        } else {
          const error = await openaiResponse.text();
          openaiStatus = `ERROR: ${openaiResponse.status} - ${error.substring(0, 100)}`;
        }
      } catch (error) {
        openaiStatus = `CONNECTION_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    return NextResponse.json({
      status: 'API Key Test Results',
      environment: process.env.NODE_ENV,
      keys: {
        anthropic: {
          configured: anthropicKey ? `${anthropicKey.substring(0, 15)}...` : 'NOT_SET',
          status: anthropicStatus,
          modelUsed: 'claude-sonnet-4-20250514'
        },
        openai: {
          configured: openaiKey ? `${openaiKey.substring(0, 12)}...` : 'NOT_SET',
          status: openaiStatus
        }
      },
      nextSteps: anthropicStatus === 'CONNECTED' && openaiStatus === 'CONNECTED' 
        ? 'Both APIs working - LLM service should be fully operational!'
        : 'Check API key configuration and model availability',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Test failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}