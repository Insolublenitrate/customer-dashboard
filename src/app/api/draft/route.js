import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { buildDraftContext, DRAFT_KINDS } from '@/lib/draftContext'
import { draftMessage } from '@/lib/ai'

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const { kind, context_id: contextId, instruction } = body

    if (!DRAFT_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Unknown draft type' }, { status: 400 })
    }
    if (!contextId) {
      return NextResponse.json({ error: 'context_id is required' }, { status: 400 })
    }

    const context = await withClient((client) => buildDraftContext(client, kind, contextId))
    if (!context) {
      return NextResponse.json({ error: 'Could not find what that draft is about' }, { status: 404 })
    }

    const draft = await draftMessage({
      kind,
      context,
      instruction: typeof instruction === 'string' ? instruction : null,
    })

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Failed to draft message:', error)
    return NextResponse.json({ error: 'Could not write that draft. Try again.' }, { status: 502 })
  }
}
