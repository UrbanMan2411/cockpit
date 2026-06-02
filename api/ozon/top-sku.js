// Vercel serverless function — proxies the Ozon Seller Analytics API.
//
// Why a proxy: the Ozon Seller API is server-to-server only (no CORS) and the
// API key must never reach the browser. Secrets live in Vercel env vars
// (OZON_CLIENT_ID, OZON_API_KEY) and are read here, server-side, only.
//
// GET /api/ozon/top-sku?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=30
// → { from, to, limit, rows:[{sku,name,revenue,units,views,conv,returns,cancellations}], totals }

const OZON_URL = 'https://api-seller.ozon.ru/v1/analytics/data'

export default async function handler(req, res) {
  const clientId = process.env.OZON_CLIENT_ID
  const apiKey = process.env.OZON_API_KEY
  if (!clientId || !apiKey) {
    return res.status(503).json({
      error: 'not_configured',
      message:
        'Не заданы OZON_CLIENT_ID и/или OZON_API_KEY в переменных окружения Vercel. ' +
        'Добавьте оба ключа и передеплойте.',
    })
  }

  const q = req.query || {}
  const iso = (d) => d.toISOString().slice(0, 10)
  const today = new Date()
  const to = typeof q.to === 'string' && q.to ? q.to : iso(today)
  const from =
    typeof q.from === 'string' && q.from
      ? q.from
      : iso(new Date(today.getTime() - 30 * 86400000))
  let limit = parseInt(q.limit, 10) || 30
  limit = Math.min(Math.max(limit, 1), 200)

  // Core analytics metrics (order matters — we read them positionally below).
  const metrics = ['revenue', 'ordered_units', 'hits_view', 'conv_tocart', 'returns', 'cancellations']
  const body = {
    date_from: from,
    date_to: to,
    metrics,
    dimension: ['sku'],
    filters: [],
    sort: [{ key: 'revenue', order: 'DESC' }],
    limit,
    offset: 0,
  }

  let ozResp, text
  try {
    ozResp = await fetch(OZON_URL, {
      method: 'POST',
      headers: {
        'Client-Id': String(clientId),
        'Api-Key': String(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    text = await ozResp.text()
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed', message: String(e && e.message || e) })
  }

  if (!ozResp.ok) {
    // surface Ozon's own error message (e.g. invalid key, bad metric, rate limit)
    return res.status(ozResp.status).json({
      error: 'ozon_error',
      status: ozResp.status,
      message: (text || '').slice(0, 600),
    })
  }

  let json
  try {
    json = JSON.parse(text)
  } catch {
    return res.status(502).json({ error: 'bad_json', message: (text || '').slice(0, 300) })
  }

  const data = (json.result && json.result.data) || []
  const rows = data.map((row) => {
    const dim = (row.dimensions && row.dimensions[0]) || {}
    const m = row.metrics || []
    return {
      sku: dim.id || '',
      name: dim.name || '',
      revenue: +m[0] || 0,
      units: +m[1] || 0,
      views: +m[2] || 0,
      conv: +m[3] || 0,
      returns: +m[4] || 0,
      cancellations: +m[5] || 0,
    }
  })
  const totals = {
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    units: rows.reduce((s, r) => s + r.units, 0),
    views: rows.reduce((s, r) => s + r.views, 0),
    skuCount: rows.length,
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ from, to, limit, rows, totals })
}
