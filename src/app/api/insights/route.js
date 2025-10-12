// src/app/api/insights/route.js
import { NextResponse } from 'next/server';
import { generatePlayerInsights } from '@/lib/awsAi';

export async function POST(request) {
  try {
    const profileData = await request.json();

    if (!profileData || !profileData.matches) {
      return NextResponse.json(
        { error: 'Profile data is required' },
        { status: 400 }
      );
    }

    console.log(`Generating insights for ${profileData.account.gameName}...`);

    const insights = await generatePlayerInsights(profileData);

    return NextResponse.json({
      success: true,
      insights
    });

  } catch (error) {
    console.error('Insights API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights', message: error.message },
      { status: 500 }
    );
  }
}