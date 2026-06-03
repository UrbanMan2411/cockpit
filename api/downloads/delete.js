// POST /api/downloads/delete { url } → removes a file from the Blob store.
import { del } from '@vercel/blob'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'not_configured', message: 'BLOB_READ_WRITE_TOKEN не задан в env.' })
  }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const url = body && body.url
  if (!url) return res.status(400).json({ error: 'no_url' })
  try {
    await del(url)
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'delete_failed', message: String((e && e.message) || e) })
  }
}
