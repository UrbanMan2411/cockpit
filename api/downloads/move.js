// POST /api/downloads/move { fromUrl, fromPathname, toPathname }
// Moves/renames a blob: copy to the new pathname, then delete the original.
// Used for both "move between folders" and "rename file" (both = new pathname).
import { copy, del } from '@vercel/blob'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'not_configured', message: 'BLOB_READ_WRITE_TOKEN не задан в env.' })
  }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { fromUrl, fromPathname, toPathname } = body || {}
  if (!fromUrl || !toPathname) return res.status(400).json({ error: 'bad_request', message: 'Нужны fromUrl и toPathname.' })
  if (fromPathname && fromPathname === toPathname) return res.status(200).json({ unchanged: true })

  try {
    const dest = await copy(fromUrl, toPathname, {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
    })
    // delete the original (copy created a new object at toPathname)
    try { await del(fromUrl) } catch { /* original may already be gone */ }
    return res.status(200).json({ url: dest.url, pathname: dest.pathname })
  } catch (e) {
    return res.status(500).json({ error: 'move_failed', message: String((e && e.message) || e) })
  }
}
