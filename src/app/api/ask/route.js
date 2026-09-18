import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { buildBusinessSnapshot } from '@/lib/businessSnapshot'
import { answerQuestion } from '@/lib/ai'

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return NextResponse.json({ error: 'Ask a question' }, { status: 400 })
    }

    // One client for the whole exchange: the tools run mid-loop and need the
    // connection to still be open when Claude reaches for them.
    const result = await withClient(async (dbClient) => {
      const snapshot = await buildBusinessSnapshot(dbClient)
      return answerQuestion({ dbClient, snapshot, history: body.history, question: question.slice(0, 2000) })
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to answer question:', error)
    return NextResponse.json({ error: 'Could not answer that one. Try again.' }, { status: 502 })
  }
}
