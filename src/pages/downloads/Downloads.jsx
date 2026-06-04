import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'

// Folders are Blob path prefixes: pathname = "<folder>/<filename>".
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
// split "folder/name" → { folder, name }; no prefix → "misc"
const parsePath = (pathname) => {
  const i = pathname.indexOf('/')
  if (i < 0) return { folder: 'misc', name: pathname }
  const folder = pathname.slice(0, i)
  const name = pathname.slice(i + 1)
  return FOLDER_KEYS.has(folder) ? { folder, name } : { folder: 'misc', name: pathname }
}

export default function Downloads() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [target, setTarget] = useState('prices') // upload destination folder
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
    for (const file of arr) {
      setBusy(file.name)
      try {
        await upload(`${target}/${file.name}`, file, { access: 'public', handleUploadUrl: '/api/downloads/upload' })
      } catch (e) {
        setError(`Не удалось загрузить «${file.name}»: ${e.message || e}`)
      }
    }
    setBusy('')
    await load()
  }, [target, load])

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

  // group items by folder, preserving FOLDERS order
  const groups = useMemo(() => {
    const by = {}
    for (const it of items || []) {
      const { folder, name } = parsePath(it.pathname)
      ;(by[folder] = by[folder] || []).push({ ...it, name })
    }
    return by
  }, [items])

  const counts = useMemo(() => {
    const c = {}
    for (const f of FOLDERS) c[f.key] = (groups[f.key] || []).length
    return c
  }, [groups])

  return (
    <>
      <h1 className="page-title">Загрузки</h1>
      <p className="page-sub">
        Общее облако для всех выгрузок. Файлы видны всем и с любого устройства. Выберите папку и загрузите файлы.
      </p>

      <div className="dl-folders">
        <span className="dl-folders-label">Загрузить в:</span>
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={'dl-fchip' + (target === f.key ? ' on' : '')}
            onClick={() => setTarget(f.key)}
          >
            {f.label}{counts[f.key] ? <span className="dl-fchip-c">{counts[f.key]}</span> : null}
          </button>
        ))}
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
            <div className="drop-title">Перетащите файлы сюда → «{labelOf(target)}»</div>
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
        const list = groups[f.key] || []
        if (!list.length) return null
        return (
          <section key={f.key} className="dl-section">
            <h2 className="dl-cat">📁 {f.label} <span className="dl-cat-c">{list.length}</span></h2>
            <div className="dl-list">
              {list.map((it) => {
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
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}
