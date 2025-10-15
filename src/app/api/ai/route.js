// src/app/api/ai/route.js
import { NextResponse } from 'next/server';
import { buildDialoguePrompt, callClaude } from '@/lib/awsAi';

export async function POST(request) {
  try {
    const { kind, profile, question, lastAnswer, match } = await request.json();
    if (!kind) {
      return NextResponse.json({ error: 'kind is required' }, { status: 400 });
    }

    const extra = { question, lastAnswer, match };
    const { system, prompt } = buildDialoguePrompt(kind, profile, extra);
    const text = await callClaude(prompt, { system, temperature: 0.6, maxTokens: 600 });
    const safe = typeof text === 'string' ? text : (text?.toString?.() ?? '');

    // When requesting followups, return parsed array
    if (kind === 'followups') {
      const parts = safe.split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
      return NextResponse.json({ success: true, followups: parts });
    }

    return NextResponse.json({ success: true, message: safe });
  } catch (error) {
    console.error('❌ AI Dialogue API Error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId
    });
    return NextResponse.json(
      { 
        error: 'Failed to get AI response', 
        message: error.message,
        details: error.name 
      },
      { status: 500 }
    );
  }
}


