import { NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const manager = searchParams.get('manager') || ''

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
    
    // Monthly Revenue Growth (Global or Manager Specific)
    const revenueParams = manager ? [manager] : [];
    const revenueWhere = manager ? `AND regional_manager = $1` : '';
    const revenueResult = await client.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', won_date), 'Mon YYYY') as month,
        SUM(order_value) as revenue
      FROM leads
      WHERE status = 'Won' AND won_date IS NOT NULL AND won_date >= NOW() - INTERVAL '12 months' ${revenueWhere}
      GROUP BY DATE_TRUNC('month', won_date), TO_CHAR(DATE_TRUNC('month', won_date), 'Mon YYYY')
      ORDER BY DATE_TRUNC('month', won_date) ASC
    `, revenueParams);

    // Cumulative Revenue
    let cumulative = 0;
    const revenueGrowth = revenueResult.rows.map(r => {
      const rev = parseFloat(r.revenue) || 0;
      cumulative += rev;
      return { month: r.month, revenue: rev, cumulative_revenue: cumulative };
    });

    // Funnel & State breakdown (if manager is selected)
    let funnel = [];
    let topStates = [];
    if (manager) {
      const funnelRes = await client.query(`
        SELECT status as name, COUNT(*) as value
        FROM leads
        WHERE regional_manager = $1
        GROUP BY status
      `, [manager]);
      funnel = funnelRes.rows.map(r => ({ name: r.name, value: parseInt(r.value) || 0 }));

      const stateRes = await client.query(`
        SELECT state as name, SUM(order_value) as value, COUNT(*) as count
        FROM leads
        WHERE regional_manager = $1 AND status = 'Won'
        GROUP BY state
        ORDER BY value DESC
        LIMIT 5
      `, [manager]);
      topStates = stateRes.rows.map(r => ({ name: r.name, value: parseFloat(r.value) || 0, count: parseInt(r.count) || 0 }));
    } else {
      // Global top states for map
      const stateRes = await client.query(`
        SELECT state, COUNT(*) as leads_count, SUM(CASE WHEN status='Won' THEN order_value ELSE 0 END) as won_revenue
        FROM leads
        GROUP BY state
      `);
      topStates = stateRes.rows.map(r => ({ state: r.state, leads_count: parseInt(r.leads_count) || 0, won_revenue: parseFloat(r.won_revenue) || 0 }));
    }

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
      revenueGrowth,
      funnel,
      topStates
    })
  } catch (error) {
    console.error('Territory Database Error:', error)
    return NextResponse.json({ error: 'Failed to fetch territory analytics' }, { status: 500 })
  }
}
