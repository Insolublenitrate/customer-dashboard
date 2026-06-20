import { NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const state = searchParams.get('state') || ''
  const tabFilter = searchParams.get('tabFilter') || 'all'
  const statusFilter = searchParams.get('statusFilter') || ''

  try {
    const client = await db.connect()
    
    let filterSql = '1=1'
    const params = []
    let paramIndex = 1

    if (search) {
      const searchStr = `%${search}%`
      filterSql += ` AND (company ILIKE $${paramIndex} OR contact_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR city ILIKE $${paramIndex} OR state ILIKE $${paramIndex} OR machine_make ILIKE $${paramIndex} OR machine_model ILIKE $${paramIndex} OR control ILIKE $${paramIndex} OR product ILIKE $${paramIndex})`
      params.push(searchStr)
      paramIndex++
    }

    if (state) {
      filterSql += ` AND state = $${paramIndex}`
      params.push(state)
      paramIndex++
    }

    if (tabFilter === 'with_email') {
      filterSql += " AND email IS NOT NULL AND email != '' AND email != 'NOT_FOUND'"
    } else if (tabFilter === 'high_value') {
      filterSql += " AND order_value >= 50000"
    }

    if (statusFilter) {
      filterSql += ` AND status = $${paramIndex}`
      params.push(statusFilter)
      paramIndex++
    }

    // 1. Average Order Value by Machine Make
    const avgValueByMachine = await client.query(`
      SELECT machine_make as name, AVG(order_value) as avg_value, COUNT(*) as count
      FROM leads 
      WHERE machine_make IS NOT NULL AND machine_make != 'Unknown' AND order_value > 0 AND ${filterSql}
      GROUP BY machine_make 
      HAVING COUNT(*) > 0
      ORDER BY avg_value DESC 
      LIMIT 5
    `, params);

    // 2. Sales Funnel (Count by Status)
    const funnelResult = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM leads 
      WHERE ${filterSql}
      GROUP BY status
    `, params);
    
    // Process Funnel Data into an ordered array
    const statusCounts = {};
    funnelResult.rows.forEach(r => { statusCounts[r.status] = parseInt(r.count) });
    const funnelData = [
      { name: 'New', value: statusCounts['New'] || 0 },
      { name: 'Contacted', value: statusCounts['Contacted'] || 0 },
      { name: 'Qualified', value: statusCounts['Qualified'] || 0 },
      { name: 'Proposal', value: statusCounts['Proposal'] || 0 },
      { name: 'Won', value: statusCounts['Won'] || 0 },
      { name: 'Lost', value: statusCounts['Lost'] || 0 }
    ];

    // 3. Top States by Won Deals
    const topStatesWon = await client.query(`
      SELECT state as name, COUNT(*) as won_deals 
      FROM leads 
      WHERE status = 'Won' AND state IS NOT NULL AND ${filterSql}
      GROUP BY state 
      ORDER BY won_deals DESC 
      LIMIT 5
    `, params);

    // 4. Pipeline Value by Stage
    const pipelineResult = await client.query(`
      SELECT status, SUM(order_value) as total_value 
      FROM leads 
      WHERE ${filterSql}
      GROUP BY status
    `, params);

    const pipelineCounts = {};
    pipelineResult.rows.forEach(r => { pipelineCounts[r.status] = parseFloat(r.total_value) || 0 });
    const pipelineData = [
      { name: 'New', value: pipelineCounts['New'] || 0 },
      { name: 'Contacted', value: pipelineCounts['Contacted'] || 0 },
      { name: 'Qualified', value: pipelineCounts['Qualified'] || 0 },
      { name: 'Proposal', value: pipelineCounts['Proposal'] || 0 },
      { name: 'Won', value: pipelineCounts['Won'] || 0 }
    ];

    // 5. Control Systems Breakdown
    const controlResult = await client.query(`
      SELECT control as name, COUNT(*) as count 
      FROM leads 
      WHERE control IS NOT NULL AND control != 'Unknown' AND ${filterSql}
      GROUP BY control 
      ORDER BY count DESC 
      LIMIT 5
    `, params);

    client.release()

    return NextResponse.json({
      valueByMachine: avgValueByMachine.rows.map(r => ({ ...r, avg_value: parseFloat(r.avg_value) })),
      funnelData,
      statesWon: topStatesWon.rows.map(r => ({ ...r, won_deals: parseInt(r.won_deals) })),
      pipelineData,
      controlData: controlResult.rows.map(r => ({ ...r, count: parseInt(r.count) }))
    })
  } catch (error) {
    console.error('Analytics Database Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
