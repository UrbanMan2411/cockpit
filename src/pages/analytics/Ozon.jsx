import React, { useCallback, useEffect, useMemo, useState } from 'react'

const PERIODS = [
  { id: 7, label: '7 дней' },
  { id: 30, label: '30 дней' },
  { id: 90, label: '90 дней' },
]

const iso = (d) => d.toISOString().slice(0, 10)
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽'
const int = (n) => Math.round(n).toLocaleString('ru-RU')
const pct = (n) => (n * 100).toFixed(1).replace('.', ',') + '%'

function rangeFor(days) {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  return { from: iso(from), to: iso(to) }
}

export default function Ozon() {
  const [days, setDays] = useState(30)
  const [state, setState] = useState({ status: 'loading', rows: [], totals: null, error: '' })

  const load = useCallback(async (d) => {
    setState((s) => ({ ...s, status: 'loading', error: '' }))
    const { from, to } = rangeFor(d)
    try {
      const r = await fetch(`/api/ozon/top-sku?from=${from}&to=${to}&limit=50`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const msg =
          j.error === 'not_configured'
            ? j.message
            : `Ozon API ответил ${j.status || r.status}: ${j.message || 'ошибка запроса'}`
        setState({ status: 'error', rows: [], totals: null, error: msg })
        return
      }
      setState({ status: 'ready', rows: j.rows || [], totals: j.totals || null, error: '', from, to })
    } catch (e) {
      setState({ status: 'error', rows: [], totals: null, error: 'Сеть недоступна: ' + (e.message || e) })
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  const maxRev = useMemo(
    () => state.rows.reduce((m, r) => Math.max(m, r.revenue), 0) || 1,
    [state.rows]
  )

  const exportCsv = useCallback(() => {
    const head = ['Ранг', 'SKU', 'Наименование', 'Выручка ₽', 'Заказы', 'Показы', 'Конверсия', 'Возвраты', 'Отмены']
    const lines = state.rows.map((r, i) =>
      [i + 1, r.sku, `"${(r.name || '').replace(/"/g, '""')}"`, Math.round(r.revenue), r.units, r.views,
       (r.conv * 100).toFixed(2) + '%', r.returns, r.cancellations].join(',')
    )
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ozon-top-sku-${state.from || ''}_${state.to || ''}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }, [state.rows, state.from, state.to])

  const top10 = state.rows.slice(0, 10)

  return (
    <>
      <h1 className="page-title">Озон · топ SKU</h1>
      <p className="page-sub">
        Аналитика продаж из вашего кабинета Ozon Seller: топ товаров по выручке, заказам,
        показам и конверсии. Данные идут через защищённый прокси — ключ не попадает в браузер.
      </p>

      <div className="oz-toolbar">
        <div className="oz-chips">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={'oz-chip' + (days === p.id ? ' on' : '')}
              onClick={() => setDays(p.id)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="oz-actions">
          <button className="btn ghost" type="button" onClick={() => load(days)} disabled={state.status === 'loading'}>
            ↻ Обновить
          </button>
          <button className="btn" type="button" onClick={exportCsv} disabled={state.status !== 'ready' || !state.rows.length}>
            ↓ Скачать CSV
          </button>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className="card oz-msg"><p>Загружаю данные Ozon…</p></div>
      )}

      {state.status === 'error' && (
        <div className="card oz-msg oz-err">
          <strong>Не удалось получить данные</strong>
          <p>{state.error}</p>
          <p className="oz-hint">
            Проверьте, что в Vercel заданы переменные <code>OZON_CLIENT_ID</code> и <code>OZON_API_KEY</code>,
            и что у ключа есть доступ к разделу «Аналитика».
          </p>
        </div>
      )}

      {state.status === 'ready' && state.totals && (
        <>
          <div className="oz-stats">
            <div className="oz-stat">
              <span className="oz-stat-label">Выручка (топ-{state.totals.skuCount})</span>
              <span className="oz-stat-val">{rub(state.totals.revenue)}</span>
            </div>
            <div className="oz-stat">
              <span className="oz-stat-label">Заказов, шт</span>
              <span className="oz-stat-val">{int(state.totals.units)}</span>
            </div>
            <div className="oz-stat">
              <span className="oz-stat-label">Показы</span>
              <span className="oz-stat-val">{int(state.totals.views)}</span>
            </div>
            <div className="oz-stat">
              <span className="oz-stat-label">SKU в выборке</span>
              <span className="oz-stat-val">{int(state.totals.skuCount)}</span>
            </div>
          </div>

          {top10.length > 0 && (
            <div className="card">
              <h3 className="oz-h3">Топ-10 по выручке</h3>
              <div className="oz-bars">
                {top10.map((r, i) => (
                  <div className="oz-bar-row" key={r.sku || i}>
                    <span className="oz-bar-name" title={r.name}>{i + 1}. {r.name || r.sku}</span>
                    <div className="oz-bar-track">
                      <div className="oz-bar-fill" style={{ width: `${Math.max(2, (r.revenue / maxRev) * 100)}%` }} />
                    </div>
                    <span className="oz-bar-val">{rub(r.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card oz-tablewrap">
            <table className="oz-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Товар</th>
                  <th className="r">Выручка</th>
                  <th className="r">Заказы</th>
                  <th className="r">Показы</th>
                  <th className="r">Конверсия</th>
                  <th className="r">Возвраты</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((r, i) => (
                  <tr key={r.sku || i}>
                    <td className="oz-rank">{i + 1}</td>
                    <td>
                      <div className="oz-name">{r.name || '—'}</div>
                      <div className="oz-sku">SKU {r.sku}</div>
                    </td>
                    <td className="r oz-rev">{rub(r.revenue)}</td>
                    <td className="r">{int(r.units)}</td>
                    <td className="r">{int(r.views)}</td>
                    <td className="r">{pct(r.conv)}</td>
                    <td className="r">{int(r.returns)}</td>
                  </tr>
                ))}
                {!state.rows.length && (
                  <tr><td colSpan={7} className="oz-empty">За выбранный период данных нет.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
