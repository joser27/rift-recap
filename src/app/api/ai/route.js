// src/app/api/ai/route.js
import { NextResponse } from 'next/server';
import { buildDialoguePrompt, callClaude } from '@/lib/awsAi';

export async function POST(request) {
  try {
    const { kind, profile, question, lastAnswer, match, includeFollowups = true } = await request.json();
    if (!kind) {
      return NextResponse.json({ error: 'kind is required' }, { status: 400 });
    }

    const extra = { question, lastAnswer, match };
    // Don't include followups for the 'followups' kind itself
    const shouldIncludeFollowups = kind !== 'followups' && includeFollowups;
    const { system, prompt } = buildDialoguePrompt(kind, profile, extra, shouldIncludeFollowups);
    const text = await callClaude(prompt, { system, temperature: 0.6, maxTokens: 600 });
    const safe = typeof text === 'string' ? text : (text?.toString?.() ?? '');

    // When requesting followups only, return parsed array
    if (kind === 'followups') {
      const parts = safe.split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
      return NextResponse.json({ success: true, followups: parts });
    }

    // Parse combined response (message + followups)
    let message = safe;
    let followups = [];
    
    // Check if response includes followups
    const followupMatch = safe.match(/FOLLOWUPS:\s*(.+?)$/is);
    if (followupMatch && shouldIncludeFollowups) {
      // Extract the main message (everything before FOLLOWUPS:)
      message = safe.replace(/\n*FOLLOWUPS:[\s\S]*$/i, '').trim();
      // Parse followup questions
      followups = followupMatch[1]
        .split('|')
        .map(q => q.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    return NextResponse.json({ 
      success: true, 
      message, 
      followups: followups.length > 0 ? followups : undefined 
    });
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


