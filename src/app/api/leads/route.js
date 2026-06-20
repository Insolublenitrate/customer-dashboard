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
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  try {
    const client = await db.connect()
    
    let query = `
      SELECT *, 
      (
        (CASE WHEN order_value >= 50000 THEN 40 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND email != '' AND email != 'NOT_FOUND' THEN 30 ELSE 0 END) +
        (CASE WHEN machine_make IN ('Makino', 'Okuma', 'Haas', 'Mazak') THEN 30 ELSE 0 END)
      ) as lead_score
      FROM leads WHERE 1=1
    `
    let countQuery = 'SELECT COUNT(*) as total FROM leads WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (search) {
      query += ` AND company ILIKE $${paramIndex}`
      countQuery += ` AND company ILIKE $${paramIndex}`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (state) {
      query += ` AND state = $${paramIndex}`
      countQuery += ` AND state = $${paramIndex}`
      params.push(state)
      paramIndex++
    }

    if (machine) {
      query += ` AND machine_make ILIKE $${paramIndex}`
      countQuery += ` AND machine_make ILIKE $${paramIndex}`
      params.push(`%${machine}%`)
      paramIndex++
    }

    // Apply Tab Filters
    if (tabFilter === 'with_email') {
      query += " AND email IS NOT NULL AND email != '' AND email != 'NOT_FOUND'"
      countQuery += " AND email IS NOT NULL AND email != '' AND email != 'NOT_FOUND'"
    } else if (tabFilter === 'high_value') {
      query += " AND order_value >= 50000"
      countQuery += " AND order_value >= 50000"
    }

    if (statusFilter) {
      query += ` AND status = $${paramIndex}`
      countQuery += ` AND status = $${paramIndex}`
      params.push(statusFilter)
      paramIndex++
    }

    // Add ordering and pagination
    const validSortFields = ['id', 'company', 'state', 'machine_make', 'order_value', 'status', 'last_contacted', 'lead_score']
    const validSortDirs = ['ASC', 'DESC']
    const safeSortField = validSortFields.includes(sortField) ? sortField : 'id'
    const safeSortDir = validSortDirs.includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'DESC'

    query += ` ORDER BY ${safeSortField} ${safeSortDir} NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    
    const countResult = await client.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // push pagination params for the main query
    params.push(limit, offset)
    const leadsResult = await client.query(query, params)

    client.release()

    return NextResponse.json({
      leads: leadsResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Database Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const client = await db.connect()
    
    const query = `
      INSERT INTO leads (
        company, contact_name, email, contact_phone, 
        city, state, zip, machine_make, machine_model, control, product, order_value, status, last_contacted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `
    const params = [
      body.company, body.contact_name, body.email, body.contact_phone,
      body.city, body.state, body.zip, body.machine_make, body.machine_model, 
      body.control, body.product, body.order_value || 0,
      body.status || 'New',
      body.last_contacted ? new Date(body.last_contacted).toISOString() : null
    ]

    const result = await client.query(query, params)
    client.release()
    
    return NextResponse.json({ id: result.rows[0].id, message: 'Lead added successfully' })
  } catch (error) {
    console.error('Failed to add lead:', error)
    return NextResponse.json({ error: 'Failed to add lead' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const client = await db.connect()
    
    if (!body.id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    const query = `
      UPDATE leads SET 
        company = $1, contact_name = $2, email = $3, contact_phone = $4, 
        city = $5, state = $6, zip = $7, machine_make = $8, machine_model = $9, 
        control = $10, product = $11, order_value = $12, status = $13, last_contacted = $14
      WHERE id = $15
    `
    const params = [
      body.company, body.contact_name, body.email, body.contact_phone,
      body.city, body.state, body.zip, body.machine_make, body.machine_model, 
      body.control, body.product, body.order_value || 0,
      body.status || 'New',
      body.last_contacted ? new Date(body.last_contacted).toISOString() : null,
      body.id
    ]

    await client.query(query, params)
    client.release()
    
    return NextResponse.json({ message: 'Lead updated successfully' })
  } catch (error) {
    console.error('Failed to update lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
