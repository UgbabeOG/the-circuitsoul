import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';

export async function GET() {
  try {
    const trends = blogAdapter.getTrends();
    return NextResponse.json({
      success: true,
      trends
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
