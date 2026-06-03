import React from 'react'

const BRIEF = [
  ['Рост категории на МП', 'WB: бытовая химия — заказы за год выросли ~2× (сент.24 ≈ 5.0 млн → сент.25 ≈ 10.7 млн). SKU 46→138 тыс., продавцов 4.6→10.3 тыс. Рынок растёт, конкуренция тоже.'],
  ['Самые быстрорастущие подкатегории', 'Освежители/нейтрализаторы запахов +126%, чистящие +86%, средства для стирки +62%. Стирка — крупнейшая категория, далее посуда, кухня/сантехника.'],
  ['Онлайн обгоняет офлайн', 'NielsenIQ: онлайн-продажи средств для стирки +96.8% за год, средств для уборки +65.8%. Канал маркетплейсов — приоритет.'],
  ['Эко и чистый состав', 'Спрос на биоразлагаемую, гипоаллергенную, без фосфатов. Локальные эко-бренды теснят международный премиум — прямо ваша поляна.'],
  ['Импортозамещение', 'Самообеспеченность РФ ~96%. Контрактное производство и СТМ растут — возможность для B2B и частных марок.'],
  ['Запахи · велнес', 'Лаванда, эвкалипт — «уборка как забота о себе». Clorox/Lysol запускают лавандовые линейки.'],
  ['Запахи · морские и природные', 'Свежесть океана, травяные эфирные масла — заходят эко-аудитории.'],
  ['Запахи · гурман и премиум', 'Ваниль, карамель, флёрдоранж, мускус — апселл, премиальные парфюмерные аккорды.'],
  ['Запахи · стойкость', 'Микрокапсулы / инкапсуляция аромата ~16% CAGR. Заявка «долго пахнет» хорошо продаёт.'],
  ['«Без запаха»', 'Стабильный сегмент: аллергики, детское, чувствительная кожа. Держать отдельным SKU.'],
  ['Регуляторика 2025+', 'Поэтапная обязательная цифровая маркировка бытовой химии и косметики — учесть в себестоимости и логистике.'],
]

const SOURCES = [
  ['ChemiCos — Рынок бытовой химии 2025–2026', 'https://chemicos.ru/ru/press/news/2025-2026'],
  ['vc.ru — Российский рынок бытовой химии: тренды и рост до 2030', 'https://vc.ru/marketing/2283828-rossijskij-rynok-bytovoj-himii-novye-trendy-i-rost-do-2030-goda'],
  ['РБК Компании — FMCG на маркетплейсах: бытовая химия', 'https://companies.rbc.ru/news/ameV4chdTI/fmcg-na-marketplejsah-kto-rastet-byistree-vseh-v-byitovoj-himii-i-uhode/'],
  ['GuruSeller — Wildberries и Ozon в 2025', 'https://guruseller.ru/wildberries-i-ozon-v-2025-godu-kuda-dvizhutsya-krupneishie-marketpleisy-rossii/'],
  ['Happi — Clean Scents Lead in Home Care', 'https://www.happi.com/clean-scents-lead-in-home-care/'],
  ['Phoenix FF — 5 Scent Trends Transforming Home Care', 'https://phoenixff.com/news/5-scent-trends-transforming-home-care/'],
]

const DOWNLOADS = [
  {
    title: 'Дашборд-шаблон',
    desc: '6 листов с формулами: цены конкурентов (₽/литр считается сам), спрос по ключам Wordstat, трекер запахов, сводка-разрывы, тренд-бриф.',
    meta: 'xlsx · 32 КБ',
    href: '/downloads/matreshka-market-analytics.xlsx',
    btn: 'Скачать xlsx',
  },
  {
    title: 'WB-скрипт (публичный поиск)',
    desc: 'Тянет цены, рейтинги, запахи по категориям WB через открытый JSON-API. Зависимостей нет — только стандартный Python. Запускать с домашнего IP без VPN.',
    meta: 'wb_scraper.py · Python 3.x',
    href: '/downloads/wb_scraper.py',
    btn: 'Скачать .py',
  },
  {
    title: 'MPSTATS-конвертер',
    desc: 'Превращает выгрузку из MPSTATS (.xlsx/.csv) в формат листа «Цены конкурентов» — сам разбирает объём/запах/формат из названий.',
    meta: 'mpstats_to_dashboard.py · Python 3.x',
    href: '/downloads/mpstats_to_dashboard.py',
    btn: 'Скачать .py',
  },
]

export default function Analytics() {
  return (
    <>
      <h1 className="page-title">Анализ рынка</h1>
      <p className="page-sub">Дашборд-шаблон, скрипты выгрузки и тренд-бриф 2025–2026.</p>

      <h2 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '8px 0 12px' }}>
        Скрипты и шаблоны
      </h2>
      <div className="cards-grid">
        {DOWNLOADS.map((d) => (
          <div key={d.title} className="card">
            <h3>{d.title}</h3>
            <div className="meta">{d.meta}</div>
            <p>{d.desc}</p>
            <a className="btn" href={d.href} download>↓ {d.btn}</a>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '36px 0 12px' }}>
        Тренды 2025–2026
      </h2>
      <div className="card">
        <dl className="brief">
          {BRIEF.map(([t, d]) => (
            <React.Fragment key={t}>
              <dt>{t}</dt>
              <dd>{d}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="sources">
          <strong style={{ color: 'var(--bordo)', fontSize: 13 }}>Источники</strong>
          <ul>
            {SOURCES.map(([t, u]) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer">{t}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
