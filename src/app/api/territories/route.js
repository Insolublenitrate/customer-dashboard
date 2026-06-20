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
        COUNT(*) as total_leads,
        ROUND(SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN status IN ('Won', 'Lost') THEN 1 ELSE 0 END), 0), 1) as win_rate,
        ROUND(AVG(EXTRACT(EPOCH FROM (won_date - created_at))/86400)) as avg_deal_velocity,
        ROUND(AVG(CASE WHEN status = 'Won' THEN order_value ELSE NULL END)) as avg_deal_size
      FROM leads
      WHERE regional_manager IS NOT NULL AND regional_manager != 'Unassigned'
      GROUP BY regional_manager
      ORDER BY won_deals DESC
    `);
    
    // Monthly Revenue Growth
    const revenueResult = await client.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', won_date), 'Mon YYYY') as month,
        SUM(order_value) as revenue
      FROM leads
      WHERE status = 'Won' AND won_date IS NOT NULL AND won_date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', won_date), TO_CHAR(DATE_TRUNC('month', won_date), 'Mon YYYY')
      ORDER BY DATE_TRUNC('month', won_date) ASC
    `);

    client.release()

    return NextResponse.json({
      territories: territoryResult.rows.map(r => ({
        ...r,
        won_deals: parseInt(r.won_deals) || 0,
        total_pipeline: parseFloat(r.total_pipeline) || 0,
        active_leads: parseInt(r.active_leads) || 0,
        total_leads: parseInt(r.total_leads) || 0,
        win_rate: parseFloat(r.win_rate) || 0,
        avg_deal_velocity: parseInt(r.avg_deal_velocity) || 0,
        avg_deal_size: parseFloat(r.avg_deal_size) || 0
      })),
      revenueGrowth: revenueResult.rows.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue) || 0
      }))
    })
  } catch (error) {
    console.error('Territory Database Error:', error)
    return NextResponse.json({ error: 'Failed to fetch territory analytics' }, { status: 500 })
  }
}
