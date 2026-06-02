// Vercel serverless function — proxies the Wildberries Analytics API (воронка
// продаж по карточкам / nm-report). Server-to-server only; the WB token lives
// in env (WB_TOKEN) and never reaches the browser.
//
// GET /api/wb/top-sku?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=30
// → { from, to, limit, rows:[{nmId,vendorCode,brand,subject,views,cart,orders,
//      revenue,buyouts,buyoutsSum,cancels,avgPrice,convCart,convOrder,buyoutPct}], totals }

const WB_URL = 'https://seller-analytics-api.wildberries.ru/api/v2/nm-report/detail'

export default async function handler(req, res) {
  const token = process.env.WB_TOKEN
  if (!token) {
    return res.status(503).json({
      error: 'not_configured',
      message:
        'Не задан WB_TOKEN в переменных окружения Vercel. Создайте токен в кабинете WB ' +
        '(Профиль → Настройки → Доступ к API, категория «Аналитика», только чтение) и передеплойте.',
    })
  }

  const q = req.query || {}
  const iso = (d) => d.toISOString().slice(0, 10)
  const today = new Date()
  const to = typeof q.to === 'string' && q.to ? q.to : iso(today)
  const from =
    typeof q.from === 'string' && q.from ? q.from : iso(new Date(today.getTime() - 30 * 86400000))
  let limit = parseInt(q.limit, 10) || 30
  limit = Math.min(Math.max(limit, 1), 100)

  const body = {
    timezone: 'Europe/Moscow',
    period: { begin: `${from} 00:00:00`, end: `${to} 23:59:59` },
    orderBy: { field: 'ordersSumRub', mode: 'desc' },
    page: 1,
  }

  let wbResp, text
  try {
    wbResp = await fetch(WB_URL, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    text = await wbResp.text()
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed', message: String((e && e.message) || e) })
  }

  if (!wbResp.ok) {
    return res.status(wbResp.status).json({
      error: 'wb_error',
      status: wbResp.status,
      message: (text || '').slice(0, 600),
    })
  }

  let json
  try {
    json = JSON.parse(text)
  } catch {
    return res.status(502).json({ error: 'bad_json', message: (text || '').slice(0, 300) })
  }

  const cards = (json.data && json.data.cards) || []
  const rows = cards.slice(0, limit).map((c) => {
    const sp = (c.statistics && c.statistics.selectedPeriod) || {}
    const conv = sp.conversions || {}
    return {
      nmId: c.nmID || '',
      vendorCode: c.vendorCode || '',
      brand: c.brandName || '',
      subject: (c.object && c.object.name) || '',
      views: +sp.openCardCount || 0,
      cart: +sp.addToCartCount || 0,
      orders: +sp.ordersCount || 0,
      revenue: +sp.ordersSumRub || 0,
      buyouts: +sp.buyoutsCount || 0,
      buyoutsSum: +sp.buyoutsSumRub || 0,
      cancels: +sp.cancelCount || 0,
      avgPrice: +sp.avgPriceRub || 0,
      convCart: +conv.addToCartPercent || 0,
      convOrder: +conv.cartToOrderPercent || 0,
      buyoutPct: +conv.buyoutsPercent || 0,
    }
  })
  const totals = {
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    orders: rows.reduce((s, r) => s + r.orders, 0),
    views: rows.reduce((s, r) => s + r.views, 0),
    skuCount: rows.length,
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ from, to, limit, rows, totals })
}
