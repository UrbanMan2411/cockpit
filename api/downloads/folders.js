// Folder registry stored in a config blob (_config/folders.json). Lets users
// create / rename / delete top-level folders from the site. Renaming changes
// only the display label — the path-prefix key stays stable, so files never
// move and links never break.
//
// GET  /api/downloads/folders                      → { folders:[{key,label}] }
// POST { action:'create', label }                  → add a folder
// POST { action:'rename', key, label }             → change a folder's label
// POST { action:'delete', key }                    → remove an empty folder
import { list, put } from '@vercel/blob'

const CONFIG = '_config/folders.json'
const DEFAULTS = [
  { key: 'prices', label: 'Прайсы' },
  { key: 'cards', label: 'Карточки' },
  { key: 'reports', label: 'Отчёты' },
]

async function readRegistry() {
  const { blobs } = await list({ prefix: CONFIG })
  const b = blobs.find((x) => x.pathname === CONFIG)
  if (!b) return null
  try {
    const r = await fetch(b.url + '?ts=' + Math.random().toString(36).slice(2), { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return Array.isArray(j.folders) ? j.folders : null
  } catch { return null }
}

async function writeRegistry(folders) {
  await put(CONFIG, JSON.stringify({ folders }), {
    access: 'public', allowOverwrite: true, contentType: 'application/json',
  })
}

const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'folder'

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'not_configured', message: 'BLOB_READ_WRITE_TOKEN не задан в env.' })
  }
  try {
    let folders = await readRegistry()
    if (!folders) { folders = DEFAULTS.slice(); await writeRegistry(folders) }

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ folders })
    }

    if (req.method === 'POST') {
      let body = req.body
      if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
      const action = body && body.action

      if (action === 'create') {
        const label = (body.label || '').trim()
        if (!label) return res.status(400).json({ error: 'no_label', message: 'Введите название папки.' })
        const taken = new Set(folders.map((f) => f.key).concat('misc', '_config'))
        let base = slugify(label), key = base, i = 2
        while (taken.has(key)) key = `${base}-${i++}`
        folders.push({ key, label })
        await writeRegistry(folders)
        return res.status(200).json({ folders, created: { key, label } })
      }

      if (action === 'rename') {
        const f = folders.find((x) => x.key === body.key)
        if (!f) return res.status(404).json({ error: 'not_found' })
        const label = (body.label || '').trim()
        if (!label) return res.status(400).json({ error: 'no_label', message: 'Введите название.' })
        f.label = label
        await writeRegistry(folders)
        return res.status(200).json({ folders })
      }

      if (action === 'delete') {
        const key = body.key
        if (!folders.some((x) => x.key === key)) return res.status(404).json({ error: 'not_found' })
        const { blobs } = await list({ prefix: key + '/' })
        if (blobs.length) {
          return res.status(409).json({ error: 'not_empty', message: 'В папке есть файлы — сначала удалите или перенесите их.' })
        }
        folders = folders.filter((x) => x.key !== key)
        await writeRegistry(folders)
        return res.status(200).json({ folders })
      }

      return res.status(400).json({ error: 'bad_action' })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    return res.status(500).json({ error: 'folders_failed', message: String((e && e.message) || e) })
  }
}
