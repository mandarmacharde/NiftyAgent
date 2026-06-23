import { useState, useEffect } from 'react'
import { api } from '../api/client'
import StatCard from '../components/StatCard'
import LiveChart from '../components/LiveChart'
import PriceTicker from '../components/PriceTicker'
import ErrorBoundary from '../components/ErrorBoundary'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Trophy,
  AlertTriangle,
  Zap,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { formatISTTime } from '../utils/time'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [openTrades, setOpenTrades] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, tick] = await Promise.all([api.getStats(), api.getTick()])
        setStats(s)
        setOpenTrades(tick.open_trades || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Real-time NIFTY 50 paper trading overview</p>
        </div>
        <ErrorBoundary><PriceTicker compact /></ErrorBoundary>
      </div>

      <ErrorBoundary><LiveChart height={440} /></ErrorBoundary>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Trades"
          value={stats.total_trades}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          label="Win Rate"
          value={`${stats.win_rate}%`}
          sub={`${stats.wins}W / ${stats.losses}L`}
          icon={Trophy}
          color={stats.win_rate >= 50 ? 'green' : 'red'}
        />
        <StatCard
          label="Net P&L"
          value={`${stats.net_pnl > 0 ? '+' : ''}${stats.net_pnl}`}
          icon={stats.net_pnl >= 0 ? TrendingUp : TrendingDown}
          color={stats.net_pnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Best Setup"
          value={stats.best_performing_setup?.setup ?? '—'}
          sub={stats.best_performing_setup ? `${stats.best_performing_setup.win_rate}% win rate` : 'No data'}
          icon={Trophy}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-white">Setup Performance</h3>
          <div className="mt-4 space-y-3">
            {Object.entries(stats.setup_performance || {}).map(([setup, data]) => (
              <div key={setup} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                <span className="text-sm font-medium text-gray-300 capitalize">{setup.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{data.wins}W / {data.losses}L</span>
                  <span className={`text-sm font-semibold ${
                    data.win_rate >= 50 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {data.win_rate}%
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(stats.setup_performance || {}).length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">No setup data yet</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
          <p className="mt-2 text-sm text-gray-500">Run the trading agents</p>
          <div className="mt-6 space-y-3">
            <QuickAction
              label="Run Analysis"
              description="Get market analysis"
              endpoint="/api/analysis"
              method="GET"
              icon={BarChart3}
              color="blue"
              onResult={setAnalysis}
            />
            <QuickAction
              label="Execute Paper Trade"
              description="Place paper trade"
              endpoint="/api/papertrade"
              method="POST"
              icon={Zap}
              color="green"
            />
            <QuickAction
              label="Close Latest Trade"
              description="Close open trade"
              endpoint="/api/close_trade"
              method="POST"
              icon={AlertTriangle}
              color="yellow"
            />
          </div>
        </div>
      </div>

      {analysis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Latest Analysis</h3>
            <span className="text-xs text-gray-500">Updated {formatISTTime(analysis.server_time || analysis.timestamp)}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <p className="text-sm text-gray-400">NIFTY Spot</p>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums">{Number(analysis.last_price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              <p className={analysis.change >= 0 ? 'mt-1 text-sm text-green-400' : 'mt-1 text-sm text-red-400'}>
                {analysis.change >= 0 ? '+' : ''}{Number(analysis.change || 0).toFixed(2)} ({analysis.change_percent}%)
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-400">Bias</p>
              <p className={`mt-1 text-2xl font-bold capitalize ${analysis.bias === 'bullish' ? 'text-green-400' : analysis.bias === 'bearish' ? 'text-red-400' : 'text-yellow-400'}`}>
                {analysis.bias || '—'}
              </p>
              <p className="mt-1 text-sm text-gray-400">Confidence: {analysis.confidence}%</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-400">Trade Signal</p>
              <p className={`mt-1 text-2xl font-bold ${analysis.trade_decision?.action === 'BUY_CALL' ? 'text-green-400' : analysis.trade_decision?.action === 'BUY_PUT' ? 'text-red-400' : 'text-yellow-400'}`}>
                {analysis.trade_decision?.action || '—'}
              </p>
              <p className="mt-1 text-sm text-gray-400 truncate">{analysis.trade_decision?.reason}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-400">VIX</p>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums">{analysis.vix_context?.vix || '—'}</p>
              <p className={`mt-1 text-sm font-semibold ${analysis.vix_context?.market_volatility === 'LOW' ? 'text-green-400' : analysis.vix_context?.market_volatility === 'HIGH' ? 'text-red-400' : 'text-yellow-400'}`}>
                {analysis.vix_context?.market_volatility || '—'} volatility
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h4 className="text-sm font-semibold text-white">Market Indicators</h4>
              <div className="mt-3 space-y-2">
                {analysis.indicators && Object.entries(analysis.indicators).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className={`font-medium ${val === 'bullish' ? 'text-green-400' : val === 'bearish' ? 'text-red-400' : 'text-yellow-400'}`}>{String(val)}</span>
                  </div>
                ))}
                {analysis.reason && <p className="mt-2 text-xs text-gray-500">{analysis.reason}</p>}
              </div>
            </div>
            <div className="card">
              <h4 className="text-sm font-semibold text-white">Risk Assessment</h4>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Trade Allowed</span>
                  {analysis.risk?.trade_allowed ? <span className="badge-green">YES</span> : <span className="badge-red">NO</span>}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Position Size</span>
                  <span className="text-gray-200">{analysis.risk?.position_size || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Risk Score</span>
                  <span className="text-gray-200">{analysis.risk?.risk_score || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Stop / Target</span>
                  <span className="text-gray-200">{analysis.risk?.stop_loss ? `${Number(analysis.risk.stop_loss).toFixed(2)} / ${Number(analysis.risk.target).toFixed(2)}` : '—'}</span>
                </div>
                {analysis.risk?.block_reason && <p className="mt-2 text-xs text-yellow-400">{analysis.risk.block_reason}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {openTrades.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Open Positions</h3>
            <span className="badge-blue ml-2">{openTrades.length}</span>
          </div>
          <div className="space-y-3">
            {openTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`badge ${t.action === 'BUY_CALL' ? 'badge-green' : 'badge-red'}`}>{t.action}</span>
                  <span className="text-sm font-semibold text-gray-200">
                    {t.strike ? Number(t.strike).toLocaleString('en-IN') : '—'}
                    <span className={`ml-1 text-[10px] font-bold ${t.option_type === 'CE' ? 'text-green-400' : 'text-red-400'}`}>{t.option_type}</span>
                  </span>
                  <span className="text-sm text-gray-400">Entry: {Number(t.entry).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="text-sm text-gray-400">Mark: {Number(t.last_price || t.entry).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <span className={`text-sm font-bold tabular-nums ${(t.unrealized_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(t.unrealized_pnl || 0) >= 0 ? '+' : ''}{Number(t.unrealized_pnl || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuickAction({ label, description, endpoint, method, icon: Icon, color, onResult }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const colorMap = {
    blue: 'border-blue-800 hover:border-blue-700 hover:bg-blue-900/20',
    green: 'border-green-800 hover:border-green-700 hover:bg-green-900/20',
    yellow: 'border-yellow-800 hover:border-yellow-700 hover:bg-yellow-900/20',
  }

  const iconColorMap = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
  }

  const handleRun = async (e) => {
    e.stopPropagation()
    setLoading(true)
    setError(null)
    try {
      const data = method === 'POST'
        ? await fetch(endpoint, { method: 'POST' }).then(r => r.json())
        : await fetch(endpoint).then(r => r.json())
      if (onResult) onResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-lg border p-4 transition-colors cursor-pointer ${colorMap[color]}`} onClick={handleRun}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 ${iconColorMap[color]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
          {loading && <p className="mt-2 text-xs text-gray-400 animate-pulse">Running...</p>}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 rounded bg-gray-800" />
        <div className="mt-2 h-4 w-64 rounded bg-gray-800" />
      </div>
      <div className="card h-[400px] animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="mt-3 h-8 w-16 rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <h3 className="mt-4 text-lg font-semibold text-white">Something went wrong</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  )
}
