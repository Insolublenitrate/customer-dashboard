import { NextResponse } from 'next/server'
import { openDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await openDb()
    
    // Total leads
    const totalLeads = await db.get('SELECT COUNT(*) as count FROM leads')
    
    // Total Order Value
    const totalOrderValue = await db.get('SELECT SUM(order_value) as sum FROM leads')
    
    // Top States
    const topStates = await db.all('SELECT state, COUNT(*) as count FROM leads WHERE state IS NOT NULL GROUP BY state ORDER BY count DESC LIMIT 5')
    
    // Top Machines
    const topMachines = await db.all('SELECT machine_make, COUNT(*) as count FROM leads WHERE machine_make IS NOT NULL AND machine_make != "Unknown" GROUP BY machine_make ORDER BY count DESC LIMIT 5')

    return NextResponse.json({
      totalLeads: totalLeads.count,
      totalOrderValue: totalOrderValue.sum,
      topStates,
      topMachines
    })
  } catch (error) {
    console.error('Database Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
