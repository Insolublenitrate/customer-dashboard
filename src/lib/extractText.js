import mammoth from 'mammoth'
import { simpleParser } from 'mailparser'

const TEXT_EXTENSIONS = ['txt', 'md', 'vtt', 'srt']

// Returns { text, isPdf, occurredAt }. For PDFs, text is null and the caller
// hands the raw bytes to Claude directly instead of extracting locally.
export async function extractText(buffer, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()

  if (TEXT_EXTENSIONS.includes(ext)) {
    return { text: buffer.toString('utf-8'), isPdf: false, occurredAt: null }
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value, isPdf: false, occurredAt: null }
  }

  if (ext === 'eml') {
    const parsed = await simpleParser(buffer)
    const text = [
      `Subject: ${parsed.subject || ''}`,
      `From: ${parsed.from?.text || ''}`,
      `To: ${parsed.to?.text || ''}`,
      `Date: ${parsed.date || ''}`,
      '',
      parsed.text || parsed.html || '',
    ].join('\n')
    return { text, isPdf: false, occurredAt: parsed.date || null }
  }

  if (ext === 'pdf') {
    return { text: null, isPdf: true, occurredAt: null }
  }

  throw new Error(`Unsupported file type: .${ext}`)
}
