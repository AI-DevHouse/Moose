// src/app/api/api-error-test/route.ts
// Direct test of Anthropic API to see actual error

import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Development only' }, { status: 403 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicKey) {
    return NextResponse.json({
      status: 'NO_API_KEY',
      message: 'ANTHROPIC_API_KEY not found in environment'
    });
  }

  try {
    console.log('Testing direct Anthropic API call...');
    console.log('API Key configured:', anthropicKey ? `${anthropicKey.slice(0, 10)}...` : 'NO');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        temperature: 0.1,
        messages: [
          { role: 'user', content: 'Say "Hello World" as JSON: {"message": "Hello World"}' }
        ]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      return NextResponse.json({
        status: 'API_ERROR',
        http_status: response.status,
        http_status_text: response.statusText,
        response_body: responseText,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    const data = JSON.parse(responseText);
    
    return NextResponse.json({
      status: 'API_SUCCESS',
      http_status: response.status,
      response_data: data,
      content: data.content?.[0]?.text || 'No content',
      usage: data.usage,
      model: data.model
    });

  } catch (error) {
    console.error('Direct API test error:', error);
    
    return NextResponse.json({
      status: 'FETCH_ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}