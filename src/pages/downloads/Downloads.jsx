import React, { useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'

const fmtSize = (b) =>
  b >= 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : b >= 1024 ? Math.round(b / 1024) + ' КБ' : b + ' Б'
const fmtDate = (s) => {
  const d = new Date(s); if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const extOf = (name) => (name.split('.').pop() || '').toLowerCase()
const baseName = (path) => path.split('/').pop()

export default function Downloads() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')   // current uploading filename
  const [dragOver, setDragOver] = useState(false)
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
    const list = Array.from(files || [])
    for (const file of list) {
      setBusy(file.name)
      try {
        await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/downloads/upload' })
      } catch (e) {
        setError(`Не удалось загрузить «${file.name}»: ${e.message || e}`)
      }
    }
    setBusy('')
    await load()
  }, [load])

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

  return (
    <>
      <h1 className="page-title">Загрузки</h1>
      <p className="page-sub">
        Общее облако для всех выгрузок: прайсы, отчёты, таблицы. Загруженные файлы видны всем и с любого устройства.
      </p>

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
            <div className="drop-title">Перетащите файлы сюда</div>
            <div className="drop-sub">или нажмите, чтобы выбрать (можно несколько, до 50 МБ)</div>
          </>
        )}
      </div>

      {error && <div className="card oz-err" style={{ marginTop: 16 }}><p style={{ margin: 0 }}>{error}</p></div>}

      <div className="dl-list">
        {items === null && <div className="card"><p style={{ margin: 0, color: 'var(--muted)' }}>Загружаю список…</p></div>}
        {items && items.length === 0 && !error && (
          <div className="card"><p style={{ margin: 0, color: 'var(--muted)' }}>Пока пусто — загрузите первый файл выше.</p></div>
        )}
        {items && items.map((it) => {
          const name = baseName(it.pathname)
          const ext = extOf(name)
          return (
            <div className="dl-row" key={it.url}>
              <span className={'dl-ext dl-' + (ext || 'file')}>{ext || 'file'}</span>
              <div className="dl-info">
                <div className="dl-name">{name}</div>
                <div className="dl-meta">{fmtSize(it.size)} · {fmtDate(it.uploadedAt)}</div>
              </div>
              <a className="btn ghost dl-btn" href={it.url} download={name} target="_blank" rel="noreferrer">↓ Скачать</a>
              <button className="dl-del" type="button" title="Удалить" onClick={() => remove(it.url, name)}>×</button>
            </div>
          )
        })}
      </div>
    </>
  )
}
