import { NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function GET() {
  try {
    const client = await db.connect()
    
    // Total leads
    const totalLeadsResult = await client.query('SELECT COUNT(*) as count FROM leads')
    
    // Total Order Value
    const totalOrderValueResult = await client.query('SELECT SUM(order_value) as sum FROM leads')
    
    // Top States
    const topStatesResult = await client.query('SELECT state, COUNT(*) as count FROM leads WHERE state IS NOT NULL GROUP BY state ORDER BY count DESC LIMIT 5')
    
    // Top Machines
    const topMachinesResult = await client.query("SELECT machine_make, COUNT(*) as count FROM leads WHERE machine_make IS NOT NULL AND machine_make != 'Unknown' GROUP BY machine_make ORDER BY count DESC LIMIT 5")

    client.release()

    return NextResponse.json({
      totalLeads: parseInt(totalLeadsResult.rows[0].count),
      totalOrderValue: parseFloat(totalOrderValueResult.rows[0].sum) || 0,
      topStates: topStatesResult.rows,
      topMachines: topMachinesResult.rows
    })
  } catch (error) {
    console.error('Database Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
