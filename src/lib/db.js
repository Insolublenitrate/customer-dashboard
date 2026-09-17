import { db } from '@vercel/postgres'

export async function withClient(fn) {
  const client = await db.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
