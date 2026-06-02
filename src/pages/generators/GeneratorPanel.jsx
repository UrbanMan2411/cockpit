import React, { useState, useCallback, useRef } from 'react'
import { parsePriceXlsx } from '../../lib/parseXlsx'

/**
 * Reusable price-list generator UI. Drop xlsx → preview → PDF.
 * Wired by each brand page with its own buildPdf function + asset paths.
 *
 * Props:
 *   title          — page heading
 *   sub            — page subhead
 *   brand          — 'matreshka' | 'greenpanda' (CSS variant)
 *   bgSwatch       — path to the default-bg thumbnail
 *   downloadName   — output PDF filename
 *   buildPdf       — async (rows, options) => Uint8Array
 */
export default function GeneratorPanel({ title, sub, brand, bgSwatch, downloadName, buildPdf }) {
  const isGreen = brand === 'greenpanda'

  const [status, setStatus] = useState('idle') // idle | parsing | ready | building | done | error
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const [bgMode, setBgMode] = useState('default')
  const [bgCustom, setBgCustom] = useState(null)
  const [bgOpacity, setBgOpacity] = useState(10)
  const bgInputRef = useRef(null)

  const onBgFile = useCallback((file) => {
    if (!file) return
    if (!/^image\//.test(file.type)) return
    const fr = new FileReader()
    fr.onload = () => { setBgCustom(fr.result); setBgMode('custom') }
    fr.readAsDataURL(file)
  }, [])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Нужен файл .xlsx'); setStatus('error'); return
    }
    setFileName(file.name)
    setStatus('parsing'); setError('')
    try {
      const { rows } = await parsePriceXlsx(file)
      if (!rows.length) throw new Error('Не нашёл товаров. Проверьте формат прайса.')
      setRows(rows)
      setStatus('ready')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Ошибка чтения файла')
      setStatus('error')
    }
  }, [])

  const generate = useCallback(async () => {
    setStatus('building'); setError('')
    try {
      const bg = bgMode === 'none' ? 'none' : bgMode === 'custom' ? (bgCustom || 'default') : 'default'
      const bytes = await buildPdf(rows, { bg, bgOpacity: bgOpacity / 100 })
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Ошибка генерации PDF')
      setStatus('error')
    }
  }, [rows, bgMode, bgCustom, bgOpacity, buildPdf, downloadName])

  // Inline edit of a product field (name / volume / sku / price) before export.
  const updateRow = useCallback((i, field, value) => {
    setRows((prev) => {
      const next = prev.slice()
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }, [])

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const withPhoto = rows.filter((r) => r.image).length
  const cls = (base) => base + (isGreen ? ' green' : '')

  return (
    <>
      <h1 className="page-title" style={isGreen ? { color: 'var(--green-9)' } : undefined}>{title}</h1>
      <p className="page-sub">{sub}</p>

      <div
        className={cls('drop') + ' ' + (dragOver ? 'over' : '') + ' ' + (status === 'error' ? 'err' : '')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        {status === 'idle' && (
          <>
            <div className="drop-icon">⬆</div>
            <div className="drop-title">Перетащите .xlsx сюда</div>
            <div className="drop-sub">или нажмите, чтобы выбрать файл</div>
          </>
        )}
        {status === 'parsing' && <div className="drop-title">Читаю файл…</div>}
        {(status === 'ready' || status === 'building' || status === 'done') && (
          <>
            <div className="drop-title">✓ {fileName}</div>
            <div className="drop-sub">Товаров: <b>{rows.length}</b> · с фото: <b>{withPhoto}</b></div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="drop-title err-t">Ошибка</div>
            <div className="drop-sub">{error}</div>
            <div className="drop-sub">нажмите, чтобы выбрать другой файл</div>
          </>
        )}
      </div>

      {(status === 'ready' || status === 'building' || status === 'done') && (
        <div className={cls('bgblock')}>
          <div className="bgblock-head">Фон PDF</div>
          <div className="bgopts">
            <button
              className={cls('bgopt') + (bgMode === 'default' ? ' on' : '')}
              onClick={() => setBgMode('default')}
              type="button"
            >
              <span className="bgsw" style={{ backgroundImage: `url(${bgSwatch})` }} />
              Стандартный
            </button>
            <button
              className={cls('bgopt') + (bgMode === 'custom' ? ' on' : '')}
              onClick={() => (bgCustom ? setBgMode('custom') : bgInputRef.current?.click())}
              type="button"
            >
              <span className="bgsw" style={bgCustom ? { backgroundImage: `url(${bgCustom})` } : {}}>
                {!bgCustom && '+'}
              </span>
              {bgCustom ? 'Свой' : 'Загрузить свой'}
            </button>
            <button
              className={cls('bgopt') + (bgMode === 'none' ? ' on' : '')}
              onClick={() => setBgMode('none')}
              type="button"
            >
              <span className="bgsw none" />
              Без фона
            </button>
            {bgCustom && (
              <button className="bgreplace" type="button" onClick={() => bgInputRef.current?.click()}>заменить</button>
            )}
            <input ref={bgInputRef} type="file" accept="image/*" hidden onChange={(e) => onBgFile(e.target.files?.[0])} />
          </div>
          {bgMode !== 'none' && (
            <label className="bgop">
              Прозрачность фона: <b>{bgOpacity}%</b>
              <input type="range" min="3" max="60" value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} />
            </label>
          )}
        </div>
      )}

      {(status === 'ready' || status === 'building' || status === 'done') && (
        <div className="actions">
          <button className={'btn' + (isGreen ? ' green' : '')} onClick={generate} disabled={status === 'building'}>
            {status === 'building' ? 'Генерирую PDF…' : 'Скачать PDF-прайс'}
          </button>
          {status === 'done' && <span className="ok">Готово — файл скачан</span>}
          <button className="btn ghost" onClick={() => { setStatus('idle'); setRows([]); setFileName('') }}>
            Загрузить другой
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="edit-hint">✎ Значения можно править прямо в таблице — название, объём, артикул и цену. Изменения попадут в PDF.</div>
          <div className={cls('preview') + ' editable'}>
            <table>
              <thead>
                <tr><th></th><th>Наименование</th><th>Объём</th><th>Артикул</th><th>Цена ₽</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.section !== rows[i - 1]?.section ? 'newsec' : ''}>
                    <td className="thumb">{r.image ? <img src={r.image} alt="" /> : <span className="nophoto">—</span>}</td>
                    <td className="nm">
                      <input
                        className="ed"
                        value={r.name}
                        onChange={(e) => updateRow(i, 'name', e.target.value)}
                        aria-label="Наименование"
                      />
                    </td>
                    <td>
                      <input
                        className="ed ed-c"
                        value={r.volume}
                        onChange={(e) => updateRow(i, 'volume', e.target.value)}
                        aria-label="Объём"
                      />
                    </td>
                    <td className="mono">
                      <input
                        className="ed ed-c"
                        value={r.sku}
                        onChange={(e) => updateRow(i, 'sku', e.target.value)}
                        aria-label="Артикул"
                      />
                    </td>
                    <td className="price">
                      <input
                        className="ed ed-r ed-price"
                        type="number"
                        step="1"
                        min="0"
                        value={Number.isFinite(r.price) ? r.price : 0}
                        onChange={(e) => updateRow(i, 'price', e.target.value === '' ? 0 : Number(e.target.value))}
                        aria-label="Цена"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
