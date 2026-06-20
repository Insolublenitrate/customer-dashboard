import { NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function GET(request) {
  try {
    const client = await db.connect()
    
    // Territory Leaderboard & Metrics
    const territoryResult = await client.query(`
      SELECT 
        regional_manager as name,
        SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) as won_deals,
        SUM(order_value) as total_pipeline,
        SUM(CASE WHEN status != 'Lost' AND status != 'Won' THEN 1 ELSE 0 END) as active_leads,
        COUNT(*) as total_leads
      FROM leads
      WHERE regional_manager IS NOT NULL AND regional_manager != 'Unassigned'
      GROUP BY regional_manager
      ORDER BY won_deals DESC
    `);
    
    client.release()

    return NextResponse.json({
      territories: territoryResult.rows.map(r => ({
        ...r,
        won_deals: parseInt(r.won_deals) || 0,
        total_pipeline: parseFloat(r.total_pipeline) || 0,
        active_leads: parseInt(r.active_leads) || 0,
        total_leads: parseInt(r.total_leads) || 0
      }))
    })
  } catch (error) {
    console.error('Territory Database Error:', error)
    return NextResponse.json({ error: 'Failed to fetch territory analytics' }, { status: 500 })
  }
}
