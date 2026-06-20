import { NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const state = searchParams.get('state') || ''
  const machine = searchParams.get('machine') || ''
  const tabFilter = searchParams.get('tabFilter') || 'all'
  const statusFilter = searchParams.get('statusFilter') || ''
  const sortField = searchParams.get('sortField') || 'id'
  const sortDir = searchParams.get('sortDir') || 'DESC'

  try {
    const client = await db.connect()
    
    let query = 'SELECT * FROM leads WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (search) {
      query += ` AND company ILIKE $${paramIndex}`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (state) {
      query += ` AND state = $${paramIndex}`
      params.push(state)
      paramIndex++
    }

    if (machine) {
      query += ` AND machine_make ILIKE $${paramIndex}`
      params.push(`%${machine}%`)
      paramIndex++
    }

    if (tabFilter === 'with_email') {
      query += " AND email IS NOT NULL AND email != '' AND email != 'NOT_FOUND'"
    } else if (tabFilter === 'high_value') {
      query += " AND order_value >= 50000"
    }

    if (statusFilter) {
      query += ` AND status = $${paramIndex}`
      params.push(statusFilter)
      paramIndex++
    }

    const validSortFields = ['id', 'company', 'state', 'machine_make', 'order_value', 'status', 'last_contacted']
    const validSortDirs = ['ASC', 'DESC']
    const safeSortField = validSortFields.includes(sortField) ? sortField : 'id'
    const safeSortDir = validSortDirs.includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'DESC'

    query += ` ORDER BY ${safeSortField} ${safeSortDir} NULLS LAST`
    
    const result = await client.query(query, params)
    client.release()

    const headers = [
      'ID', 'Company', 'Contact Name', 'Email', 'Phone', 'City', 'State', 'Zip',
      'Machine Make', 'Machine Model', 'Control', 'Product', 'Order Value', 'Status', 'Last Contacted'
    ]

    const csvRows = [headers.join(',')]

    result.rows.forEach(row => {
      const values = [
        row.id,
        `"${(row.company || '').replace(/"/g, '""')}"`,
        `"${(row.contact_name || '').replace(/"/g, '""')}"`,
        `"${(row.email || '').replace(/"/g, '""')}"`,
        `"${(row.contact_phone || '').replace(/"/g, '""')}"`,
        `"${(row.city || '').replace(/"/g, '""')}"`,
        `"${(row.state || '').replace(/"/g, '""')}"`,
        `"${(row.zip || '').replace(/"/g, '""')}"`,
        `"${(row.machine_make || '').replace(/"/g, '""')}"`,
        `"${(row.machine_model || '').replace(/"/g, '""')}"`,
        `"${(row.control || '').replace(/"/g, '""')}"`,
        `"${(row.product || '').replace(/"/g, '""')}"`,
        row.order_value || 0,
        `"${(row.status || '').replace(/"/g, '""')}"`,
        `"${row.last_contacted ? new Date(row.last_contacted).toLocaleDateString() : ''}"`
      ]
      csvRows.push(values.join(','))
    })

    return new NextResponse(csvRows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="leads_export.csv"',
      },
    })
  } catch (error) {
    console.error('Export Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
