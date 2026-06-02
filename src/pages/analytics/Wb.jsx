import React, { useCallback, useEffect, useMemo, useState } from 'react'

const PERIODS = [
  { id: 7, label: '7 дней' },
  { id: 30, label: '30 дней' },
  { id: 90, label: '90 дней' },
]

const iso = (d) => d.toISOString().slice(0, 10)
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽'
const int = (n) => Math.round(n).toLocaleString('ru-RU')
const pct = (n) => (+n || 0).toFixed(1).replace('.', ',') + '%'

function rangeFor(days) {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  return { from: iso(from), to: iso(to) }
}

export default function Wb() {
  const [days, setDays] = useState(30)
  const [state, setState] = useState({ status: 'loading', rows: [], totals: null, error: '' })

  const load = useCallback(async (d) => {
    setState((s) => ({ ...s, status: 'loading', error: '' }))
    const { from, to } = rangeFor(d)
    try {
      const r = await fetch(`/api/wb/top-sku?from=${from}&to=${to}&limit=50`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const msg =
          j.error === 'not_configured'
            ? j.message
            : `WB API ответил ${j.status || r.status}: ${j.message || 'ошибка запроса'}`
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
    const head = ['Ранг', 'nmID', 'Артикул', 'Бренд', 'Предмет', 'Показы', 'В корзину', 'Заказы',
      'Выручка ₽', 'Выкупы', 'Конв. в корзину', 'Конв. в заказ', 'Выкуп %']
    const lines = state.rows.map((r, i) =>
      [i + 1, r.nmId, `"${(r.vendorCode || '').replace(/"/g, '""')}"`,
       `"${(r.brand || '').replace(/"/g, '""')}"`, `"${(r.subject || '').replace(/"/g, '""')}"`,
       r.views, r.cart, r.orders, Math.round(r.revenue), r.buyouts,
       pct(r.convCart), pct(r.convOrder), pct(r.buyoutPct)].join(',')
    )
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wb-top-sku-${state.from || ''}_${state.to || ''}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }, [state.rows, state.from, state.to])

  const top10 = state.rows.slice(0, 10)

  return (
    <div className="wb-scope">
      <h1 className="page-title">Wildberries · топ SKU</h1>
      <p className="page-sub">
        Воронка продаж по карточкам из кабинета WB: показы → корзина → заказы → выкупы,
        выручка и конверсии по каждому SKU. Запрос идёт через защищённый прокси — токен не попадает в браузер.
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
        <div className="card oz-msg"><p>Загружаю данные Wildberries…</p></div>
      )}

      {state.status === 'error' && (
        <div className="card oz-msg oz-err">
          <strong>Не удалось получить данные</strong>
          <p>{state.error}</p>
          <p className="oz-hint">
            Проверьте, что в Vercel задана переменная <code>WB_TOKEN</code> с доступом к категории «Аналитика».
            У эндпоинта воронки лимит ~3 запроса/мин — при ошибке 429 подождите минуту.
          </p>
        </div>
      )}

      {state.status === 'ready' && state.totals && (
        <>
          <div className="oz-stats">
            <div className="oz-stat">
              <span className="oz-stat-label">Выручка заказов (топ-{state.totals.skuCount})</span>
              <span className="oz-stat-val">{rub(state.totals.revenue)}</span>
            </div>
            <div className="oz-stat">
              <span className="oz-stat-label">Заказов, шт</span>
              <span className="oz-stat-val">{int(state.totals.orders)}</span>
            </div>
            <div className="oz-stat">
              <span className="oz-stat-label">Показы карточек</span>
              <span className="oz-stat-val">{int(state.totals.views)}</span>
            </div>
            <div className="oz-stat">
              <span className="oz-stat-label">SKU в выборке</span>
              <span className="oz-stat-val">{int(state.totals.skuCount)}</span>
            </div>
          </div>

          {top10.length > 0 && (
            <div className="card">
              <h3 className="oz-h3">Топ-10 по выручке заказов</h3>
              <div className="oz-bars">
                {top10.map((r, i) => (
                  <div className="oz-bar-row" key={r.nmId || i}>
                    <span className="oz-bar-name" title={`${r.vendorCode} · ${r.brand}`}>
                      {i + 1}. {r.vendorCode || r.nmId}
                    </span>
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
                  <th className="r">Показы</th>
                  <th className="r">В корзину</th>
                  <th className="r">Заказы</th>
                  <th className="r">Выручка</th>
                  <th className="r">Конв. в заказ</th>
                  <th className="r">Выкуп %</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((r, i) => (
                  <tr key={r.nmId || i}>
                    <td className="oz-rank">{i + 1}</td>
                    <td>
                      <div className="oz-name">{r.vendorCode || '—'}{r.brand ? ` · ${r.brand}` : ''}</div>
                      <div className="oz-sku">nmID {r.nmId}{r.subject ? ` · ${r.subject}` : ''}</div>
                    </td>
                    <td className="r">{int(r.views)}</td>
                    <td className="r">{int(r.cart)}</td>
                    <td className="r">{int(r.orders)}</td>
                    <td className="r oz-rev">{rub(r.revenue)}</td>
                    <td className="r">{pct(r.convOrder)}</td>
                    <td className="r">{pct(r.buyoutPct)}</td>
                  </tr>
                ))}
                {!state.rows.length && (
                  <tr><td colSpan={8} className="oz-empty">За выбранный период данных нет.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
