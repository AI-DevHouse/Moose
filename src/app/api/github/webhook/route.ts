import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log("WEBHOOK FUNCTION CALLED - THIS SHOULD ALWAYS APPEAR");
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    
    const githubEvent = request.headers.get('x-github-event');
    const githubDelivery = request.headers.get('x-github-delivery');
    const githubSignature = request.headers.get('x-hub-signature-256');
    
    console.log('\n=== GITHUB WEBHOOK RECEIVED ===');
    console.log(`Event: ${githubEvent}`);
    console.log(`Delivery ID: ${githubDelivery}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Signature: ${githubSignature ? 'Present' : 'Missing'}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('=== END WEBHOOK ===\n');
    
    switch (githubEvent) {
      case 'ping':
        console.log('✅ Webhook ping received - GitHub connection verified');
        return NextResponse.json({ 
          message: 'Webhook ping received successfully',
          timestamp: new Date().toISOString() 
        });
      default:
        console.log(`ℹ️ Unhandled event type: ${githubEvent}`);
    }
    
    return NextResponse.json({ 
      received: true, 
      event: githubEvent,
      processed: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Webhook processing failed', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    timestamp: new Date().toISOString(),
    ready: true
  });
}