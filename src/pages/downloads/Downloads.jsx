import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'

// Folders are Blob path prefixes. One optional sub-folder level is supported:
// pathname = "<folder>/<sub>/<filename>" or "<folder>/<filename>".
const FOLDERS = [
  { key: 'prices', label: 'Прайсы' },
  { key: 'cards', label: 'Карточки' },
  { key: 'reports', label: 'Отчёты' },
  { key: 'misc', label: 'Разное' },
]
const FOLDER_KEYS = new Set(FOLDERS.map((f) => f.key))
const labelOf = (key) => (FOLDERS.find((f) => f.key === key) || { label: key }).label

const fmtSize = (b) =>
  b >= 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : b >= 1024 ? Math.round(b / 1024) + ' КБ' : b + ' Б'
const fmtDate = (s) => {
  const d = new Date(s); if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const extOf = (name) => (name.split('.').pop() || '').toLowerCase()

// split pathname → { folder, sub, name }
const parsePath = (pathname) => {
  const seg = pathname.split('/')
  if (seg.length === 1) return { folder: 'misc', sub: '', name: pathname }
  if (!FOLDER_KEYS.has(seg[0])) return { folder: 'misc', sub: '', name: pathname }
  if (seg.length >= 3) return { folder: seg[0], sub: seg[1], name: seg.slice(2).join('/') }
  return { folder: seg[0], sub: '', name: seg[1] }
}
const cleanSub = (s) => s.trim().replace(/[/\\]+/g, '-').replace(/\s+/g, ' ')

export default function Downloads() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [target, setTarget] = useState('cards') // upload destination folder
  const [sub, setSub] = useState('')             // optional sub-folder
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch('/api/downloads/list')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.message || 'Не удалось получить список'); setItems([]); return }
      setItems(j.items || [])
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)); setItems([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const doUpload = useCallback(async (files) => {
    const arr = Array.from(files || [])
    const s = cleanSub(sub)
    for (const file of arr) {
      setBusy(file.name)
      const path = s ? `${target}/${s}/${file.name}` : `${target}/${file.name}`
      try {
        await upload(path, file, { access: 'public', handleUploadUrl: '/api/downloads/upload' })
      } catch (e) {
        setError(`Не удалось загрузить «${file.name}»: ${e.message || e}`)
      }
    }
    setBusy('')
    await load()
  }, [target, sub, load])

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files) }

  const remove = useCallback(async (url, name) => {
    if (!window.confirm(`Удалить «${name}»? Файл исчезнет у всех.`)) return
    setError('')
    try {
      const r = await fetch('/api/downloads/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.message || 'Не удалось удалить'); return }
      await load()
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)) }
  }, [load])

  // group by folder → sub
  const groups = useMemo(() => {
    const by = {}
    for (const it of items || []) {
      const { folder, sub, name } = parsePath(it.pathname)
      by[folder] = by[folder] || { subs: {}, count: 0 }
      const sk = sub || ''
      ;(by[folder].subs[sk] = by[folder].subs[sk] || []).push({ ...it, name })
      by[folder].count++
    }
    return by
  }, [items])

  const counts = useMemo(() => {
    const c = {}
    for (const f of FOLDERS) c[f.key] = groups[f.key]?.count || 0
    return c
  }, [groups])

  // sub-folder suggestions for the currently selected target
  const subSuggestions = useMemo(() => {
    const s = new Set(Object.keys(groups[target]?.subs || {}).filter(Boolean))
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [groups, target])

  const renderRows = (list) =>
    list.map((it) => {
      const ext = extOf(it.name)
      return (
        <div className="dl-row" key={it.url}>
          <span className={'dl-ext dl-' + (ext || 'file')}>{ext || 'file'}</span>
          <div className="dl-info">
            <div className="dl-name">{it.name}</div>
            <div className="dl-meta">{fmtSize(it.size)} · {fmtDate(it.uploadedAt)}</div>
          </div>
          <a className="btn ghost dl-btn" href={it.url} download={it.name} target="_blank" rel="noreferrer">↓ Скачать</a>
          <button className="dl-del" type="button" title="Удалить" onClick={() => remove(it.url, it.name)}>×</button>
        </div>
      )
    })

  return (
    <>
      <h1 className="page-title">Загрузки</h1>
      <p className="page-sub">
        Общее облако для всех выгрузок. Файлы видны всем и с любого устройства. Выберите папку (и при желании подпапку) — и загрузите файлы.
      </p>

      <div className="dl-folders">
        <span className="dl-folders-label">Загрузить в:</span>
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={'dl-fchip' + (target === f.key ? ' on' : '')}
            onClick={() => { setTarget(f.key); setSub('') }}
          >
            {f.label}{counts[f.key] ? <span className="dl-fchip-c">{counts[f.key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="dl-subrow">
        <span className="dl-sublabel">Подпапка:</span>
        <input
          className="dl-subinput"
          list="dl-sub-suggest"
          value={sub}
          placeholder={`напр. Антижир — необязательно`}
          onChange={(e) => setSub(e.target.value)}
        />
        <datalist id="dl-sub-suggest">
          {subSuggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        {subSuggestions.length > 0 && (
          <span className="dl-subchips">
            {subSuggestions.map((s) => (
              <button key={s} type="button" className={'dl-subchip' + (cleanSub(sub) === s ? ' on' : '')} onClick={() => setSub(s)}>{s}</button>
            ))}
          </span>
        )}
      </div>

      <div
        className={'drop ' + (dragOver ? 'over' : '') + (busy ? ' busy' : '')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => doUpload(e.target.files)} />
        {busy ? (
          <>
            <div className="drop-title">Загружаю «{busy}»…</div>
            <div className="drop-sub">не закрывайте вкладку</div>
          </>
        ) : (
          <>
            <div className="drop-icon">⬆</div>
            <div className="drop-title">Перетащите файлы → «{labelOf(target)}{cleanSub(sub) ? ` / ${cleanSub(sub)}` : ''}»</div>
            <div className="drop-sub">или нажмите, чтобы выбрать (можно несколько, до 50 МБ)</div>
          </>
        )}
      </div>

      {error && <div className="card oz-err" style={{ marginTop: 16 }}><p style={{ margin: 0 }}>{error}</p></div>}

      {items === null && <div className="card" style={{ marginTop: 20 }}><p style={{ margin: 0, color: 'var(--muted)' }}>Загружаю список…</p></div>}
      {items && items.length === 0 && !error && (
        <div className="card" style={{ marginTop: 20 }}><p style={{ margin: 0, color: 'var(--muted)' }}>Пока пусто — загрузите первый файл выше.</p></div>
      )}

      {FOLDERS.map((f) => {
        const g = groups[f.key]
        if (!g || !g.count) return null
        const subKeys = Object.keys(g.subs).sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b, 'ru'))
        return (
          <section key={f.key} className="dl-section">
            <h2 className="dl-cat">📁 {f.label} <span className="dl-cat-c">{g.count}</span></h2>
            {subKeys.map((sk) => (
              <div key={sk || '_root'} className="dl-sub">
                {sk && <div className="dl-subhead">↳ {sk} <span className="dl-cat-c">{g.subs[sk].length}</span></div>}
                <div className="dl-list">{renderRows(g.subs[sk])}</div>
              </div>
            ))}
          </section>
        )
      })}
    </>
  )
}
