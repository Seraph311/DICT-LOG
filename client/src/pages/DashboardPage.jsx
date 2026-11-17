import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from '../components/Layout.jsx';
import { api } from '../api.js';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthStart(month) {
  return `${month}-01`;
}

function monthEnd(month) {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function ChartFrame({ title, children, empty }) {
  return (
    <section className="card chart-card">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Visitor activity</p>
          <h2>{title}</h2>
        </div>
      </div>
      {empty ? <p className="empty-state">No visitor records match this range.</p> : children}
    </section>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth);
  const [from, setFrom] = useState(() => monthStart(currentMonth()));
  const [to, setTo] = useState(() => monthEnd(currentMonth()));
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [csmSummary, setCsmSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [tab, setTab] = useState('visitors');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api(`/api/dashboard/summary?month=${encodeURIComponent(month)}`),
      api(`/api/dashboard/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ])
      .then(([summaryData, analyticsData]) => {
        if (!active) return;
        setSummary(summaryData);
        setAnalytics(analyticsData);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, from, to]);

  useEffect(() => {
    if (tab !== 'csm' || csmSummary) return;
    api('/api/csm/summary')
      .then(setCsmSummary)
      .catch((requestError) => setError(requestError.message));
  }, [tab, csmSummary]);

  useEffect(() => {
    if (tab !== 'forecast' || forecast) return;
    api('/api/forecast?granularity=week')
      .then(setForecast)
      .catch((requestError) => setError(requestError.message));
  }, [tab, forecast]);

  const hasVisitorData = Boolean(analytics?.byDay.length || analytics?.byPurpose.length);
  const dailyData = useMemo(
    () => (analytics?.byDay ?? []).map((item) => ({ ...item, label: item.day.slice(5) })),
    [analytics],
  );
  const monthlyData = useMemo(() => analytics?.byMonth ?? [], [analytics]);
  const forecastData = useMemo(() => {
    if (!forecast) return [];
    const observed = forecast.observed.map((point) => ({
      period: point.period,
      observed: point.count,
    }));
    const predicted = forecast.forecast.map((point) => ({
      period: point.period,
      forecast: point.count,
    }));
    return [...observed, ...predicted]
      .reduce((points, point) => {
        const existing = points.find((item) => item.period === point.period);
        if (existing) Object.assign(existing, point);
        else points.push({ ...point });
        return points;
      }, [])
      .sort((left, right) => left.period.localeCompare(right.period));
  }, [forecast]);

  function handleMonthChange(event) {
    const nextMonth = event.target.value;
    setMonth(nextMonth);
    setFrom(monthStart(nextMonth));
    setTo(monthEnd(nextMonth));
  }

  return (
    <Layout>
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Visitor dashboard</h1>
          <p className="muted">A clear view of active visitor records and service demand.</p>
        </div>
        <div className="dashboard-stamp" aria-label="Data privacy notice">
          <span className="stamp-dot" aria-hidden="true" />
          Aggregates only
        </div>
      </div>

      <section className="card dashboard-filters">
        <div className="field">
          <label htmlFor="dashboard-month">Summary month</label>
          <input id="dashboard-month" type="month" value={month} onChange={handleMonthChange} />
        </div>
        <div className="field">
          <label htmlFor="dashboard-from">Chart range from</label>
          <input id="dashboard-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="dashboard-to">Chart range to</label>
          <input id="dashboard-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </section>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
        <button
          type="button"
          className={`dashboard-tab ${tab === 'visitors' ? 'is-active' : ''}`}
          role="tab"
          aria-selected={tab === 'visitors'}
          onClick={() => setTab('visitors')}
        >
          Visitor activity
        </button>
        <button
          type="button"
          className={`dashboard-tab ${tab === 'csm' ? 'is-active' : ''}`}
          role="tab"
          aria-selected={tab === 'csm'}
          onClick={() => setTab('csm')}
        >
          CSM summary
        </button>
        <button
          type="button"
          className={`dashboard-tab ${tab === 'forecast' ? 'is-active' : ''}`}
          role="tab"
          aria-selected={tab === 'forecast'}
          onClick={() => setTab('forecast')}
        >
          Forecast
        </button>
      </div>

      {tab === 'forecast' ? (
        !forecast ? (
          <div className="center-screen" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading forecast…
          </div>
        ) : forecast.forecast.length === 0 ? (
          <section className="card empty-panel">
            <p className="eyebrow">Forecast unavailable</p>
            <h2>Not enough history</h2>
            <p className="muted">{forecast.note}</p>
          </section>
        ) : (
          <>
            <section className="card chart-card">
              <div className="chart-heading">
                <div>
                  <p className="eyebrow">Visitor outlook</p>
                  <h2>Weekly forecast</h2>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={forecastData} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7dee9" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="observed" name="Observed" stroke="#0b3d91" strokeWidth={3} connectNulls />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#c58b00" strokeWidth={3} strokeDasharray="8 5" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </section>
            <section className="card">
              <h2>Forecast accuracy</h2>
              <table className="metrics-table">
                <thead>
                  <tr><th>Model</th><th>MAE</th><th>MAPE</th></tr>
                </thead>
                <tbody>
                  {[
                    ['Moving average + seasonality', forecast.metrics.model],
                    ['Naive baseline', forecast.metrics.naive],
                  ].map(([label, values]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{values.mae?.toFixed(2) ?? '—'}</td>
                      <td>{values.mape == null ? '—' : `${values.mape.toFixed(2)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">Accuracy depends on the amount of history available.</p>
            </section>
          </>
        )
      ) : tab === 'csm' ? (
        !csmSummary ? (
          <div className="center-screen" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading CSM summary…
          </div>
        ) : (
          <div className="csm-summary-grid">
            {[
              ['By service type', csmSummary.byServiceType],
              ['By office', csmSummary.byOffice],
              ['By age group', csmSummary.byAgeGroup],
              ['By region', csmSummary.byRegion],
              ['By sex', csmSummary.bySex],
            ].map(([title, data]) => (
              <ChartFrame key={title} title={title} empty={!data.length}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data} layout="vertical" margin={{ left: 18, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d7dee9" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0b3d91" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            ))}
          </div>
        )
      ) : loading ? (
        <div className="center-screen" role="status">
          <span className="spinner" aria-hidden="true" />
          Loading dashboard…
        </div>
      ) : (
        <>
          <section className="summary-grid" aria-label="Visitor summary">
            {[
              ['Total visitors', summary?.total ?? 0, 'All active records in the selected month'],
              ['Male visitors', summary?.male ?? 0, 'Selected month'],
              ['Female visitors', summary?.female ?? 0, 'Selected month'],
              ["Today's visitors", summary?.today ?? 0, 'Active records dated today'],
            ].map(([label, value, detail]) => (
              <article className="summary-card" key={label}>
                <p className="summary-label">{label}</p>
                <p className="summary-value">{formatNumber(value)}</p>
                <p className="summary-detail">{detail}</p>
              </article>
            ))}
          </section>

          {!hasVisitorData ? (
            <section className="card empty-panel">
              <p className="eyebrow">No activity yet</p>
              <h2>No visitor records in this range</h2>
              <p className="muted">Try widening the date range or check back after the next log entry.</p>
            </section>
          ) : (
            <div className="chart-grid">
              <ChartFrame title="Visitors by purpose" empty={!analytics.byPurpose.length}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.byPurpose} layout="vertical" margin={{ left: 18, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d7dee9" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="purpose" type="category" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0b3d91" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>

              <ChartFrame title="Daily trend" empty={!analytics.byDay.length}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyData} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7dee9" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#c58b00" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFrame>

              <ChartFrame title="Monthly trend" empty={!monthlyData.length}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyData} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7dee9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#0b3d91" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
