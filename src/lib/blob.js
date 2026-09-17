import { put, get } from '@vercel/blob'

export async function uploadCommunicationFile(buffer, filename, contentType) {
  const blob = await put(`communications/${Date.now()}-${filename}`, buffer, {
    access: 'private',
    contentType,
    addRandomSuffix: true,
  })
  return blob
}

// Server-side authenticated read of a private blob, for a proxied download.
export async function readCommunicationFile(url) {
  return get(url, { access: 'private' })
}
