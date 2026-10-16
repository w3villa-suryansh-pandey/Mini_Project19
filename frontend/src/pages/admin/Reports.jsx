import { useEffect, useMemo, useState } from 'react'
import AccountBadge from '../../components/AccountBadge.jsx'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { getAdminReport } from '../../services/api.js'

const PERIODS = [
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
]

const METRICS = [
  { key: 'activeUsers', label: 'Active users', color: '#4f46e5' },
  { key: 'activeSubscribers', label: 'Active subscribers', color: '#0891b2' },
  { key: 'subscriptionValueInPaise', label: 'Subscription value', color: '#059669' },
]

const numberFormat = new Intl.NumberFormat('en-IN')
const currencyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function money(amountInPaise) {
  return currencyFormat.format((amountInPaise || 0) / 100)
}

function formatPeriodDate(dateValue, period) {
  const date = new Date(dateValue)
  return new Intl.DateTimeFormat('en-IN', period === 'year'
    ? { month: 'short', timeZone: 'UTC' }
    : period === 'week'
      ? { weekday: 'short', timeZone: 'UTC' }
      : { day: 'numeric', timeZone: 'UTC' }).format(date)
}

function Reports() {
  const [period, setPeriod] = useState('month')
  const [metric, setMetric] = useState('activeSubscribers')
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setError('')
    getAdminReport(period)
      .then((data) => { if (isCurrent) setReport(data) })
      .catch((loadError) => { if (isCurrent) setError(loadError.message || 'Could not load reports.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [period])

  const selectedMetric = METRICS.find((item) => item.key === metric) || METRICS[0]
  const chart = useMemo(() => {
    const values = report?.trend || []
    const width = 800
    const left = 24
    const right = width - 24
    const top = 22
    const bottom = 174
    const maximum = Math.max(1, ...values.map((item) => item[metric] || 0))
    const points = values.map((item, index) => {
      const x = values.length === 1 ? width / 2 : left + index * (right - left) / (values.length - 1)
      const y = bottom - ((item[metric] || 0) / maximum) * (bottom - top)
      return { x, y, value: item[metric] || 0, date: item.date }
    })
    const pointString = points.map((point) => `${point.x},${point.y}`).join(' ')
    const labels = points.filter((_, index) => {
      if (period === 'week') return true
      if (period === 'year') return true
      return index === 0 || (index + 1) % 5 === 0 || index === points.length - 1
    })
    return { points, pointString, labels, bottom }
  }, [metric, period, report])

  const summary = report?.summary || { activeUsers: 0, activeSubscribers: 0, subscriptionValueInPaise: 0, subscriptionCount: 0 }
  const plans = report?.plans || []
  const largestPlanValue = Math.max(1, ...plans.map((plan) => plan.subscriptionValueInPaise || 0))
  const periodLabel = PERIODS.find((item) => item.key === period)?.label || 'Monthly'
  const reportStart = report?.start ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(report.start)) : ''
  const reportEnd = report?.end ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(new Date(report.end).getTime() - 1)) : ''

  return (
    <main className="admin-layout admin-reports-page">
      <AdminSidebar active="reports" />
      <section className="admin-main-panel">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">Administration <span>/</span> Reports</div>
          <div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<AccountBadge variant="admin" /></div>
        </header>
        <div className="admin-content admin-reports-content">
          <div className="admin-page-heading">
            <div><p className="admin-eyebrow">BUSINESS INSIGHTS</p><h1>Reports</h1><p>Track user growth, subscriptions, and revenue.</p></div>
            <div className="report-period-switch" role="group" aria-label="Report period">
              {PERIODS.map((item) => <button type="button" key={item.key} className={period === item.key ? 'active' : ''} aria-pressed={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
            </div>
          </div>

          {error && <p className="admin-inline-notice" role="alert">{error}</p>}

          <section className="report-summary-grid" aria-label={`${periodLabel} summary`} aria-busy={isLoading}>
            <article className="report-summary-card violet"><span className="report-summary-icon" aria-hidden="true">♙</span><p>Active users</p><strong>{isLoading ? '—' : numberFormat.format(summary.activeUsers)}</strong><small>Active accounts joined in this period</small></article>
            <article className="report-summary-card blue"><span className="report-summary-icon" aria-hidden="true">✦</span><p>Active subscribers</p><strong>{isLoading ? '—' : numberFormat.format(summary.activeSubscribers)}</strong><small>Users with subscription coverage</small></article>
            <article className="report-summary-card green"><span className="report-summary-icon" aria-hidden="true">₹</span><p>Subscription value</p><strong>{isLoading ? '—' : money(summary.subscriptionValueInPaise)}</strong><small>Captured subscription value this period</small></article>
            <article className="report-summary-card amber"><span className="report-summary-icon" aria-hidden="true">↻</span><p>Subscriptions sold</p><strong>{isLoading ? '—' : numberFormat.format(summary.subscriptionCount)}</strong><small>Successful subscription payments</small></article>
          </section>

          <section className="admin-panel report-trend-panel" aria-labelledby="report-trend-title" aria-busy={isLoading}>
            <div className="report-panel-heading">
              <div><p className="admin-eyebrow">PERFORMANCE</p><h2 id="report-trend-title">{periodLabel} trend</h2><p>{reportStart && reportEnd ? `${reportStart} – ${reportEnd}` : 'Report activity over time'}</p></div>
              <div className="report-metric-switch" role="group" aria-label="Trend metric">
                {METRICS.map((item) => <button type="button" key={item.key} className={metric === item.key ? 'active' : ''} aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}><i style={{ '--metric-color': item.color }} />{item.label}</button>)}
              </div>
            </div>
            {isLoading ? <div className="report-chart-empty">Loading report data…</div> : (chart.points.length ? <div className="report-chart-wrap">
              <svg className="report-chart" viewBox="0 0 800 220" role="img" aria-label={`${selectedMetric.label} ${periodLabel.toLowerCase()} trend`} preserveAspectRatio="none">
                <defs><linearGradient id="report-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={selectedMetric.color} stopOpacity=".22" /><stop offset="100%" stopColor={selectedMetric.color} stopOpacity=".015" /></linearGradient></defs>
                {[0, 1, 2, 3].map((line) => <line key={line} x1="24" x2="776" y1={22 + line * 50} y2={22 + line * 50} className="report-chart-gridline" />)}
                <polygon points={`24,174 ${chart.pointString} 776,174`} fill="url(#report-area-fill)" />
                <polyline points={chart.pointString} fill="none" stroke={selectedMetric.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {chart.points.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r={period === 'month' ? 2.5 : 4} fill={selectedMetric.color}><title>{formatPeriodDate(point.date, period)}: {metric === 'subscriptionValueInPaise' ? money(point.value) : numberFormat.format(point.value)}</title></circle>)}
              </svg>
              <div className="report-chart-labels">{chart.labels.map((point, index) => <span key={`${point.date}-${index}`}>{formatPeriodDate(point.date, period)}</span>)}</div>
            </div> : <div className="report-chart-empty">No report data for this period yet.</div>)}
            <p className="report-definition-note">{metric === 'activeUsers' ? 'Counts currently active user accounts created in the selected period.' : metric === 'activeSubscribers' ? 'Counts currently active user accounts whose subscription covered each date in the selected period.' : 'Shows the value of captured subscription payments by purchase date.'}</p>
          </section>

          <section className="admin-panel report-plans-panel" aria-labelledby="report-plans-title" aria-busy={isLoading}>
            <div className="report-panel-heading"><div><p className="admin-eyebrow">PLAN PERFORMANCE</p><h2 id="report-plans-title">Plan-wise subscribers</h2><p>Subscription coverage and payment value by plan</p></div><span className="admin-demo-tag">{periodLabel.toUpperCase()}</span></div>
            {isLoading ? <div className="report-chart-empty">Loading plan data…</div> : plans.length ? <div className="report-plan-list">
              {plans.map((plan, index) => <article className="report-plan-row" key={plan.planId || plan.planName}>
                <div className={`report-plan-mark tone-${index % 4}`} aria-hidden="true">{plan.planName?.trim().charAt(0).toUpperCase() || 'P'}</div>
                <div className="report-plan-main"><div className="report-plan-title"><strong>{plan.planName}</strong><span>{numberFormat.format(plan.subscribers)} subscriber{plan.subscribers === 1 ? '' : 's'}</span></div><div className="report-plan-track"><span style={{ width: `${Math.max(plan.subscriptionValueInPaise ? 4 : 0, plan.subscriptionValueInPaise / largestPlanValue * 100)}%` }} /></div></div>
                <div className="report-plan-value"><strong>{money(plan.subscriptionValueInPaise)}</strong><small>{numberFormat.format(plan.subscriptionCount)} sale{plan.subscriptionCount === 1 ? '' : 's'}</small></div>
              </article>)}
            </div> : <div className="report-chart-empty">No plan subscriptions overlap this period.</div>}
            <p className="report-definition-note">Subscriber totals count distinct active accounts with subscription coverage during the period. Plan value counts captured payments made during the period.</p>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Reports
