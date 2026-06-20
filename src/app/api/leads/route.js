import { NextResponse } from 'next/server'
import { openDb } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const state = searchParams.get('state') || ''
  const machine = searchParams.get('machine') || ''
  const tabFilter = searchParams.get('tabFilter') || 'all'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  try {
    const db = await openDb()
    
    let query = 'SELECT * FROM leads WHERE 1=1'
    let countQuery = 'SELECT COUNT(*) as total FROM leads WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND company LIKE ?'
      countQuery += ' AND company LIKE ?'
      params.push(`%${search}%`)
    }

    if (state) {
      query += ' AND state = ?'
      countQuery += ' AND state = ?'
      params.push(state)
    }

    if (machine) {
      query += ' AND machine_make LIKE ?'
      countQuery += ' AND machine_make LIKE ?'
      params.push(`%${machine}%`)
    }

    // Apply Tab Filters
    if (tabFilter === 'with_email') {
      query += " AND email IS NOT NULL AND email != '' AND email != 'NOT_FOUND'"
      countQuery += " AND email IS NOT NULL AND email != '' AND email != 'NOT_FOUND'"
    } else if (tabFilter === 'high_value') {
      query += " AND order_value >= 50000"
      countQuery += " AND order_value >= 50000"
    }

    // Add ordering and pagination
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?'
    
    const countResult = await db.get(countQuery, params)
    const total = countResult.total

    // push pagination params for the main query
    params.push(limit, offset)
    const leads = await db.all(query, params)

    return NextResponse.json({
      leads,
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
    const db = await openDb()
    
    const query = `
      INSERT INTO leads (
        company, contact_name, email, contact_phone, 
        city, state, zip, machine_make, machine_model, control, product, order_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const params = [
      body.company, body.contact_name, body.email, body.contact_phone,
      body.city, body.state, body.zip, body.machine_make, body.machine_model, 
      body.control, body.product, body.order_value || 0
    ]

    const result = await db.run(query, params)
    
    return NextResponse.json({ id: result.lastID, message: 'Lead added successfully' })
  } catch (error) {
    console.error('Failed to add lead:', error)
    return NextResponse.json({ error: 'Failed to add lead' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const db = await openDb()
    
    if (!body.id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    const query = `
      UPDATE leads SET 
        company = ?, contact_name = ?, email = ?, contact_phone = ?, 
        city = ?, state = ?, zip = ?, machine_make = ?, machine_model = ?, 
        control = ?, product = ?, order_value = ?
      WHERE id = ?
    `
    const params = [
      body.company, body.contact_name, body.email, body.contact_phone,
      body.city, body.state, body.zip, body.machine_make, body.machine_model, 
      body.control, body.product, body.order_value || 0,
      body.id
    ]

    await db.run(query, params)
    
    return NextResponse.json({ message: 'Lead updated successfully' })
  } catch (error) {
    console.error('Failed to update lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
