import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Line, LineChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, ReferenceLine
} from 'recharts'
import {
  Activity, BarChart3, CalendarDays, CheckCircle2,
  ChevronDown, Clock3, Cloud, Download, Gauge,
  LayoutDashboard, Menu, RefreshCw, Search, Wind,
  TrendingDown, TrendingUp, AlertTriangle, Zap
} from 'lucide-react'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API,
  timeout: 20000
})

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'explorer', label: 'Forecast Explorer', icon: Activity },
  { id: 'accuracy', label: 'Accuracy Analytics', icon: BarChart3 },
  { id: 'evolution', label: 'Forecast Evolution', icon: Clock3 },
  { id: 'insights', label: 'Procurement Insights', icon: Zap }
]

function asArray(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.records)) return response.records
  if (Array.isArray(response?.results)) return response.results
  return []
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMW(value) {
  return `${number(value).toLocaleString('en-GB', {
    maximumFractionDigits: 0
  })} MW`
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function shortDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short'
  })
}

function MetricCard({ label, value, unit, note, icon: Icon, tone = 'blue' }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}><Icon size={18} /></span>
      </div>
      <div className="metric-value">
        {value}<small>{unit}</small>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  )
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>
}

function Overview({ overview, comparison, daily, loading, onNavigate }) {
  const metrics = overview?.metrics || {}

  const chartData = useMemo(() => comparison.slice(0, 168).map(row => ({
    ...row,
    label: formatDate(row.delivery_time || row.start_time || row.startTime)
  })), [comparison])

  const dailyData = daily.map(row => ({
    ...row,
    dateLabel: shortDate(row.delivery_date || row.date)
  }))

  return (
    <>
      <SectionHeading
        eyebrow="JANUARY 2026 · NATIONAL WIND"
        title="Executive overview"
        description="A consolidated view of wind generation forecast performance and day-ahead accuracy."
        action={<span className="live-status"><span /> Dataset validated</span>}
      />

     <div className="metric-grid">
  <MetricCard
    label="Mean Absolute Error"
    value={number(metrics.mae_mw).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}
    unit="MW"
    note="Average absolute forecast deviation"
    icon={Gauge}
  />

  <MetricCard
    label="Root Mean Square Error"
    value={number(metrics.rmse_mw).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}
    unit="MW"
    note="Penalises larger forecast errors"
    icon={Activity}
    tone="purple"
  />

  <MetricCard
    label="Forecast Bias"
    value={`${number(metrics.bias_mw) > 0 ? '+' : ''}${number(metrics.bias_mw).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`}
    unit="MW"
    note="Positive indicates overforecasting"
    icon={TrendingUp}
    tone="orange"
  />

  <MetricCard
    label="Weighted Absolute Error"
    value={number(metrics.wape_percent).toFixed(2)}
    unit="%"
    note="Error relative to actual generation"
    icon={BarChart3}
    tone="green"
  />
</div>

      <div className="overview-strip">
        <div className="strip-item">
          <span className="strip-icon"><CalendarDays size={17} /></span>
          <div><small>Analysis period</small><strong>{overview?.period || 'January 2026'}</strong></div>
        </div>
        <div className="strip-item">
          <span className="strip-icon"><Clock3 size={17} /></span>
          <div><small>Delivery hours</small><strong>{overview?.total_delivery_hours ?? 744} / 744</strong></div>
        </div>
        <div className="strip-item">
          <span className="strip-icon"><Wind size={17} /></span>
          <div><small>Average actual</small><strong>{formatMW(overview?.average_actual_generation_mw)}</strong></div>
        </div>
        <div className="strip-item">
          <span className="strip-icon"><Cloud size={17} /></span>
          <div><small>Average forecast</small><strong>{formatMW(overview?.average_forecast_generation_mw)}</strong></div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="panel chart-panel wide-panel">
          <div className="panel-heading">
            <div><h3>Forecast vs actual generation</h3><p>First seven days · hourly MW</p></div>
            <span className="chart-tag">Hourly comparison</span>
          </div>
          {loading ? <EmptyState message="Loading chart data…" /> : chartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243348" />
                <XAxis dataKey="label" tick={{ fill: '#8292a8', fontSize: 10 }} minTickGap={35} />
                <YAxis tick={{ fill: '#8292a8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111d2d', border: '1px solid #2a3b51', borderRadius: 10 }} />
                <Legend />
                <Line type="monotone" dataKey="forecast_mw" name="Forecast" stroke="#48a9ff" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="actual_mw" name="Actual" stroke="#35d6a1" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No comparison data returned by the API." />}
          <button className="text-action" onClick={() => onNavigate('explorer')}>Explore hourly data <span>→</span></button>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><h3>Data integrity</h3><p>January delivery coverage</p></div>
            <CheckCircle2 className="success-icon" size={21} />
          </div>
          <div className="integrity-number">{overview?.total_delivery_hours ?? 744}<small> / 744 hours</small></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: '100%' }} /></div>
          <div className="integrity-row"><span>Missing forecasts</span><strong>{overview?.missing_forecasts ?? 0}</strong></div>
          <div className="integrity-row"><span>Missing actuals</span><strong>{overview?.missing_actuals ?? 0}</strong></div>
          <div className="integrity-footer"><CheckCircle2 size={15} /> Complete hourly coverage</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div><h3>Daily forecast error</h3><p>Mean absolute error by delivery date</p></div>
          <button className="text-action" onClick={() => onNavigate('accuracy')}>View analytics →</button>
        </div>
        {dailyData.length ? (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243348" />
              <XAxis dataKey="dateLabel" tick={{ fill: '#8292a8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8292a8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111d2d', border: '1px solid #2a3b51', borderRadius: 10 }} />
              <Bar dataKey="mae_mw" name="Daily MAE" fill="#4ca9ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState message="Daily performance data is not available." />}
      </div>
    </>
  )
}

function Explorer({ comparison }) {
  const [selectedDate, setSelectedDate] = useState('all')
  const dates = [...new Set(comparison.map(row => String(row.delivery_date || row.delivery_time || '').slice(0, 10)).filter(Boolean))]

  const rows = comparison.filter(row => selectedDate === 'all' ||
    String(row.delivery_date || row.delivery_time || '').startsWith(selectedDate))

  const chartData = rows.map(row => ({
    ...row,
    label: formatDate(row.delivery_time || row.start_time || row.startTime)
  }))

  return (
    <>
      <SectionHeading eyebrow="HOURLY ANALYSIS" title="Forecast explorer" description="Compare day-ahead wind generation forecasts against observed generation." />
      <div className="panel">
        <div className="filter-row">
          <div><h3>Hourly generation profile</h3><p>{rows.length} delivery periods selected</p></div>
          <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
            <option value="all">All January 2026</option>
            {dates.map(date => <option key={date} value={date}>{date}</option>)}
          </select>
        </div>
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={370}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243348" />
              <XAxis dataKey="label" tick={{ fill: '#8292a8', fontSize: 10 }} minTickGap={35} />
              <YAxis tick={{ fill: '#8292a8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111d2d', border: '1px solid #2a3b51', borderRadius: 10 }} />
              <Legend />
              <Line type="monotone" dataKey="forecast_mw" name="Forecast MW" stroke="#48a9ff" dot={false} />
              <Line type="monotone" dataKey="actual_mw" name="Actual MW" stroke="#35d6a1" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState message="No hourly comparison records found." />}
      </div>

      <div className="panel">
        <div className="panel-heading"><div><h3>Delivery period records</h3><p>Forecast, actual and signed error</p></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Delivery time</th><th>Forecast</th><th>Actual</th><th>Error</th><th>Publication time</th></tr></thead>
            <tbody>
              {rows.slice(0, 100).map((row, index) => {
                const error = number(row.forecast_error_mw)
                return <tr key={index}>
                  <td>{formatDate(row.delivery_time || row.start_time || row.startTime)}</td>
                  <td>{formatMW(row.forecast_mw)}</td>
                  <td>{formatMW(row.actual_mw)}</td>
                  <td className={error >= 0 ? 'positive' : 'negative'}>{error > 0 ? '+' : ''}{error.toLocaleString('en-GB')} MW</td>
                  <td>{formatDate(row.publish_time)}</td>
                </tr>
              })}
            </tbody>
          </table>
          {rows.length > 100 && <p className="table-footnote">Showing first 100 of {rows.length} records.</p>}
        </div>
      </div>
    </>
  )
}

function Accuracy({ daily }) {
  const sorted = [...daily].sort(
    (a, b) => number(b.mae) - number(a.mae)
  )

  const chartData = sorted.map(row => ({
    ...row,
    dateLabel: shortDate(row.delivery_date)
  }))

  return (
    <>
      <SectionHeading
        eyebrow="PERFORMANCE DIAGNOSTICS"
        title="Accuracy analytics"
        description="Identify days with the largest forecast deviations and examine directional bias."
      />

      <div className="metric-grid">
        <MetricCard
          label="Highest Daily MAE"
          value={formatMW(sorted[0]?.mae).replace(' MW', '')}
          unit="MW"
          note={sorted[0]?.delivery_date || 'No data'}
          icon={TrendingUp}
          tone="orange"
        />

        <MetricCard
          label="Lowest Daily MAE"
          value={formatMW(sorted[sorted.length - 1]?.mae).replace(' MW', '')}
          unit="MW"
          note={sorted[sorted.length - 1]?.delivery_date || 'No data'}
          icon={TrendingDown}
          tone="green"
        />

        <MetricCard
          label="Daily Records"
          value={daily.length}
          unit="days"
          note="January 2026"
          icon={CalendarDays}
        />

        <MetricCard
          label="Delivery Observations"
          value={daily.reduce((sum, row) => sum + number(row.observations), 0)}
          unit="hours"
          note="24 observations per day"
          icon={Activity}
          tone="purple"
        />
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Daily mean absolute error</h3>
            <p>Higher values indicate larger average deviations</p>
          </div>
        </div>

        {chartData.length ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243348" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: '#8292a8', fontSize: 10 }}
              />
              <YAxis tick={{ fill: '#8292a8', fontSize: 11 }} />
              <Tooltip
  formatter={(value) => [
    `${number(value).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} MW`,
    'Daily MAE'
  ]}
  contentStyle={{
    backgroundColor: '#111d2d',
    border: '1px solid #3b526d',
    borderRadius: '12px',
    padding: '14px 18px',
    color: '#e8eef7',
    boxShadow: '0 8px 25px rgba(0,0,0,0.4)'
  }}
  labelStyle={{
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '8px'
  }}
  itemStyle={{
    color: '#65baff',
    fontSize: '13px',
    fontWeight: 500
  }}
  wrapperStyle={{
    outline: 'none',
    zIndex: 1000
  }}
  cursor={{
    fill: 'rgba(72, 169, 255, 0.08)'
  }}
/>
              <Bar
                dataKey="mae"
                name="Daily MAE"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((row, index) => (
                  <Cell
                    key={index}
                    fill={number(row.mae) >= 4000 ? '#f0a34b' : '#4ca9ff'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="Daily analytics data is not available." />
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Daily performance ranking</h3>
            <p>Sorted from highest to lowest MAE</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>MAE</th>
                <th>Bias</th>
                <th>RMSE</th>
                <th>Interpretation</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((row, index) => {
                const bias = number(row.bias)

                return (
                  <tr key={row.delivery_date || index}>
                    <td>{row.delivery_date}</td>

                    <td>{formatMW(row.mae)}</td>

                    <td className={bias >= 0 ? 'positive' : 'negative'}>
                      {bias > 0 ? '+' : ''}
                      {formatMW(bias)}
                    </td>

                    <td>{formatMW(row.rmse)}</td>

                    <td>
                      {bias > 0
                        ? 'Overforecast tendency'
                        : bias < 0
                        ? 'Underforecast tendency'
                        : 'Balanced'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Evolution({ comparison }) {
  const [deliveryTime, setDeliveryTime] = useState('')
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const options = comparison.filter(row => row.delivery_time || row.start_time)
    .slice(0, 744)

  async function loadEvolution(value) {
    if (!value) return
    setDeliveryTime(value)
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/api/evolution', { params: { delivery_time: value } })
      setVersions(asArray(response.data))
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load forecast versions. Check the API response format.')
      setVersions([])
    } finally {
      setLoading(false)
    }
  }

  const chartData = versions
  .map(row => {
    const publishedAt = row.publishTime || row.publish_time

    return {
      ...row,
      label: formatDate(publishedAt),
      publishTimestamp: new Date(publishedAt).getTime(),
      forecast: number(row.generation ?? row.forecast_mw)
    }
  })
  .sort((a, b) => a.publishTimestamp - b.publishTimestamp)

const cutoffTimestamp = deliveryTime
  ? (() => {
      const cutoff = new Date(deliveryTime)
      cutoff.setUTCDate(cutoff.getUTCDate() - 1)
      cutoff.setUTCHours(11, 0, 0, 0)
      return cutoff.getTime()
    })()
  : null

  return (
    <>
      <SectionHeading eyebrow="PUBLICATION HISTORY" title="Forecast evolution" description="Inspect how a forecast changed as new WINDFOR publications became available." />
      <div className="panel">
        <div className="filter-row">
          <div><h3>Select a delivery hour</h3><p>Publication versions for one delivery period</p></div>
          <select value={deliveryTime} onChange={e => loadEvolution(e.target.value)}>
            <option value="">Choose delivery period</option>
            {options.map((row, index) => {
              const value = row.delivery_time || row.start_time
              return <option key={`${value}-${index}`} value={value}>{formatDate(value)}</option>
            })}
          </select>
        </div>
        {loading && <EmptyState message="Loading publication history…" />}
        {error && <EmptyState message={error} />}
        {!loading && !error && chartData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243348" />
                <XAxis
                  dataKey="publishTimestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={value => formatDate(value)}
                  tick={{ fill: '#8292a8', fontSize: 10 }}
                  minTickGap={35}
                />
                <YAxis tick={{ fill: '#8292a8', fontSize: 11 }} />
               <Tooltip
  labelFormatter={value => `Published: ${formatDate(value)}`}
  formatter={(value) => [
    `${number(value).toLocaleString('en-GB')} MW`,
    'Forecast generation'
  ]}
  contentStyle={{
    backgroundColor: '#111d2d',
    border: '1px solid #3b526d',
    borderRadius: '12px',
    padding: '14px 18px',
    color: '#e8eef7',
    boxShadow: '0 8px 25px rgba(0,0,0,0.4)'
  }}
  labelStyle={{
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '8px'
  }}
  itemStyle={{
    color: '#65baff',
    fontSize: '12px'
  }}
  wrapperStyle={{ outline: 'none', zIndex: 1000 }}
/>
                <Area type="monotone" dataKey="forecast" name="Forecast MW" stroke="#48a9ff" fill="#48a9ff" fillOpacity={0.13} />
                {cutoffTimestamp && (
                  <ReferenceLine
                    x={cutoffTimestamp}
                    stroke="#f0a34b"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    label={{
                      value: '11:00 UK cutoff',
                      position: 'insideTopRight',
                      fill: '#f0b35f',
                      fontSize: 12
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            <div className="integrity-row"><span>Publication versions returned</span><strong>{versions.length}</strong></div>
          </>
        )}
        {!loading && !error && !chartData.length && <EmptyState message="Select a delivery period to inspect its publication history." />}
      </div>
    </>
  )
}

function Insights({ overview }) {
  const metrics = overview?.metrics || {}
  const bias = number(metrics.bias_mw)
  return (
    <>
      <SectionHeading eyebrow="OPERATIONAL INTERPRETATION" title="Procurement insights" description="Translate wind forecast performance into directional operational considerations." />
      <div className="insight-grid">
        <div className="panel insight-card">
          <span className="insight-symbol orange"><TrendingUp size={23} /></span>
          <div className="eyebrow">DIRECTIONAL BIAS</div>
          <h3>{bias >= 0 ? 'Overforecast tendency' : 'Underforecast tendency'}</h3>
          <div className="insight-number">{bias > 0 ? '+' : ''}{bias.toLocaleString('en-GB', { maximumFractionDigits: 0 })} MW</div>
          <p>{bias >= 0
            ? 'On average, the forecast exceeded observed wind generation. If other factors remain unchanged, this could mean less wind generation was available than anticipated.'
            : 'On average, the forecast was below observed wind generation. Actual wind generation exceeded the forecast on average.'}</p>
        </div>
        <div className="panel insight-card">
          <span className="insight-symbol blue"><Gauge size={23} /></span>
          <div className="eyebrow">FORECAST ACCURACY</div>
          <h3>Mean absolute error</h3>
          <div className="insight-number">{number(metrics.mae_mw).toLocaleString('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} MW</div>
          <p>The average absolute difference between forecast and actual wind generation across the 744 January delivery hours.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading"><div><h3>Operational considerations</h3><p>What these results may mean for a day-ahead team</p></div></div>
        <div className="consideration-list">
          <div><span className="consideration-icon"><AlertTriangle size={18} /></span><div><strong>Review high-error delivery periods</strong><p>Prioritise hours with unusually large absolute forecast errors for operational review.</p></div></div>
          <div><span className="consideration-icon"><TrendingUp size={18} /></span><div><strong>Monitor directional bias</strong><p>A persistent positive bias may indicate a systematic tendency to overestimate wind generation.</p></div></div>
          <div><span className="consideration-icon"><Clock3 size={18} /></span><div><strong>Respect publication cutoffs</strong><p>Use only forecast versions published by the assumed day-ahead decision cutoff to avoid look-ahead bias.</p></div></div>
        </div>
      </div>
      <div className="disclaimer">
        <AlertTriangle size={18} />
        <div><strong>Scope limitation</strong><p>This analysis uses national wind actuals and forecasts only. It does not include demand, market prices, balancing costs or other generation sources. It therefore does not calculate residual demand, procurement volumes, financial exposure or realised savings. The 11:00 UK day-ahead cutoff is an analytical assumption for this pilot.</p></div>
      </div>
    </>
  )
}

export default function App() {
  const [active, setActive] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [comparison, setComparison] = useState([])
  const [daily, setDaily] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)

  async function loadDashboard() {
    setLoading(true)
    setApiError('')
    try {
      const [overviewRes, comparisonRes, dailyRes] = await Promise.all([
        api.get('/api/overview'),
        api.get('/api/comparison'),
        api.get('/api/daily')
      ])
      setOverview(overviewRes.data)
      setComparison(asArray(comparisonRes.data))
      setDaily(asArray(dailyRes.data))
    } catch (err) {
      setApiError(err.response?.data?.detail || err.message || 'Unable to connect to the backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const activeLabel = navItems.find(item => item.id === active)?.label || 'Overview'

  function navigate(id) {
    setActive(id)
    setMobileMenu(false)
  }

  function exportCSV() {
    if (!comparison.length) return
    const headers = Object.keys(comparison[0])
    const csv = [
      headers.join(','),
      ...comparison.map(row => headers.map(key =>
        `"${String(row[key] ?? '').replaceAll('"', '""')}"`
      ).join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'windsight-january-2026-comparison.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Wind size={23} /></div>
          <div><strong>WindSight</strong><small>FORECAST INTELLIGENCE</small></div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navItems.map(item => {
            const Icon = item.icon
            return <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
              <Icon size={18} /><span>{item.label}</span>
              {active === item.id && <span className="nav-active-dot" />}
            </button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-card">
            <div className="source-icon"><Zap size={17} /></div>
            <strong>Data source</strong>
            <span>Elexon BMRS</span>
            <small>FUELHH · WINDFOR</small>
          </div>
          <div className="sidebar-foot">WIND INTELLIGENCE PLATFORM<br />PILOT ANALYSIS · JAN 2026</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button>
            <div className="breadcrumb">Workspace <span>/</span> {activeLabel}</div>
          </div>
          <div className="topbar-actions">
            <span className="period-pill"><CalendarDays size={14} /> January 2026</span>
            <button className="icon-button" title="Refresh data" onClick={loadDashboard}><RefreshCw size={17} /></button>
            <button className="export-button" onClick={exportCSV}><Download size={16} /> Export CSV</button>
          </div>
        </header>

        <div className="content">
          {apiError && <div className="error-banner"><AlertTriangle size={18} /><div><strong>Backend connection issue</strong><p>{apiError}. Confirm the FastAPI server is running on port 8000.</p></div><button onClick={loadDashboard}>Retry</button></div>}
          {loading && !overview ? <div className="loading-state"><div className="loader" />Loading WindSight analytics…</div> : (
            <>
              {active === 'overview' && <Overview overview={overview} comparison={comparison} daily={daily} loading={loading} onNavigate={navigate} />}
              {active === 'explorer' && <Explorer comparison={comparison} />}
              {active === 'accuracy' && <Accuracy daily={daily} />}
              {active === 'evolution' && <Evolution comparison={comparison} />}
              {active === 'insights' && <Insights overview={overview} />}
            </>
          )}
          <footer className="app-footer">
            <span>WindSight <span className="footer-dot">•</span> UK National Wind Forecast Intelligence</span>
            <span>Data: Elexon BMRS <span className="footer-dot">•</span> January 2026</span>
          </footer>
        </div>
      </main>
    </div>
  )
}