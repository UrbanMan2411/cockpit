// POST /api/downloads/upload — issues a client-upload token so the browser can
// upload directly to Vercel Blob (bypasses the 4.5 MB function-body limit).
// The secret BLOB_READ_WRITE_TOKEN stays server-side.
import { handleUpload } from '@vercel/blob/client'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'not_configured', message: 'BLOB_READ_WRITE_TOKEN не задан в env.' })
  }
  try {
    const json = await handleUpload({
      request: req,
      body: req.body,
      onBeforeGenerateToken: async () => ({
        addRandomSuffix: false,   // keep the original filename as the path
        allowOverwrite: true,     // re-uploading the same name replaces it
        maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB cap
      }),
      onUploadCompleted: async () => {},
    })
    return res.status(200).json(json)
  } catch (e) {
    return res.status(400).json({ error: 'upload_failed', message: String((e && e.message) || e) })
  }
}
