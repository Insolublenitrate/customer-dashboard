import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { readCommunicationFile } from '@/lib/blob'

// Proxies the original uploaded file back to the browser. The blob is
// stored private, so this authenticated route is the only way to read it.
export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const row = await withClient(async (client) => {
      const result = await client.query('SELECT storage_url, source_filename FROM communications WHERE id = $1', [id])
      return result.rows[0]
    })

    if (!row?.storage_url) {
      return NextResponse.json({ error: 'No file stored for this communication' }, { status: 404 })
    }

    const blob = await readCommunicationFile(row.storage_url)
    if (!blob?.stream) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': blob.blob.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${row.source_filename || 'download'}"`,
      },
    })
  } catch (error) {
    console.error('Failed to fetch communication file:', error)
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
  }
}
