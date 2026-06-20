import { NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function GET() {
  try {
    const client = await db.connect()
    
    // 1. Average Order Value by Machine Make (only top 5 machines with highest avg order value)
    const avgValueByMachine = await client.query(`
      SELECT machine_make as name, AVG(order_value) as avg_value, COUNT(*) as count
      FROM leads 
      WHERE machine_make IS NOT NULL AND machine_make != 'Unknown' AND order_value > 0
      GROUP BY machine_make 
      HAVING COUNT(*) > 10
      ORDER BY avg_value DESC 
      LIMIT 5
    `);

    // 2. Sales Funnel (Count by Status)
    const funnelResult = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM leads 
      GROUP BY status
    `);
    
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
      WHERE status = 'Won' AND state IS NOT NULL
      GROUP BY state 
      ORDER BY won_deals DESC 
      LIMIT 5
    `);

    client.release()

    return NextResponse.json({
      valueByMachine: avgValueByMachine.rows.map(r => ({ ...r, avg_value: parseFloat(r.avg_value) })),
      funnelData,
      statesWon: topStatesWon.rows.map(r => ({ ...r, won_deals: parseInt(r.won_deals) }))
    })
  } catch (error) {
    console.error('Analytics Database Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
