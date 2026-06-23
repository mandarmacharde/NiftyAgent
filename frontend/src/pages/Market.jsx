import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import TradeTable from '../components/TradeTable'
import LiveChart from '../components/LiveChart'
import OptionsChain from '../components/OptionsChain'
import ErrorBoundary from '../components/ErrorBoundary'
import {
  Activity,
  AlertTriangle,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { formatISTTime } from '../utils/time'

export default function Market() {
  const [analysis, setAnalysis] = useState(null)
  const [openTrades, setOpenTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tradeResult, setTradeResult] = useState(null)
  const [trading, setTrading] = useState(false)
  const [feedStatus, setFeedStatus] = useState('connecting')
  const [flash, setFlash] = useState(null)
  const [marketClosed, setMarketClosed] = useState(false)
  const prevPrice = useRef(null)

  const applyState = (state) => {
    if (state.market_closed !== undefined) setMarketClosed(state.market_closed)
    if (state.analysis) {
      const newPrice = state.analysis.last_price
      if (prevPrice.current != null && newPrice !== prevPrice.current) {
        setFlash(newPrice > prevPrice.current ? 'up' : 'down')
        setTimeout(() => setFlash(null), 500)
      }
      prevPrice.current = newPrice
      setAnalysis(state.analysis)
    }
    setOpenTrades(state.open_trades || [])
    setStats(state.stats)
    setError(null)
    setLoading(false)
  }

  const refresh = async () => {
    const state = await api.getTick()
    applyState(state)
  }

  useEffect(() => {
    let alive = true
    let socket

    const loadSnapshot = async () => {
      try {
        const state = await api.getTick()
        if (alive) applyState(state)
      } catch (err) {
        if (alive) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    loadSnapshot()

    try {
      socket = api.connectMarketFeed()
      socket.onopen = () => setFeedStatus('live')
      socket.onmessage = (event) => applyState(JSON.parse(event.data))
      socket.onerror = () => setFeedStatus('fallback')
      socket.onclose = () => setFeedStatus('fallback')
    } catch {
      setFeedStatus('fallback')
    }

    const interval = window.setInterval(loadSnapshot, 15000)

    return () => {
      alive = false
      window.clearInterval(interval)
      if (socket) socket.close()
    }
  }, [])

  const executeTrade = async () => {
    setTrading(true)
    setTradeResult(null)
    try {
      const result = await api.paperTrade()
      setTradeResult(result)
      await refresh()
    } catch (err) {
      setTradeResult({ error: err.message })
    } finally {
      setTrading(false)
    }
  }

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />
  if (!analysis) return null

  const BiasIcon = analysis.bias === 'bullish' ? TrendingUp : analysis.bias === 'bearish' ? TrendingDown : Minus
  const biasColor = analysis.bias === 'bullish' ? 'text-green-400' : analysis.bias === 'bearish' ? 'text-red-400' : 'text-yellow-400'
  const live = feedStatus === 'live'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Market Analysis</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="inline-flex items-center gap-2">
              {live ? <Wifi className="h-4 w-4 text-green-400" /> : <WifiOff className="h-4 w-4 text-yellow-400" />}
              {live ? 'Live WebSocket feed' : 'Polling fallback'}
            </span>
            {marketClosed && (
              <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">MARKET CLOSED</span>
            )}
            <span>Updated {formatISTTime(analysis.server_time || analysis.timestamp)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={refresh} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={executeTrade} disabled={trading || openTrades.length > 0 || marketClosed} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <Zap className="h-4 w-4" />
            {marketClosed ? 'Market Closed' : trading ? 'Executing...' : 'Execute Paper Trade'}
          </button>
        </div>
      </div>

      <ErrorBoundary><LiveChart height={460} /></ErrorBoundary>

      <ErrorBoundary><OptionsChain height={480} /></ErrorBoundary>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-400">NIFTY Live</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums transition-colors duration-300 ${
            flash === 'up' ? 'text-green-300' : flash === 'down' ? 'text-red-300' : 'text-white'
          }`}>
            {formatPrice(analysis.last_price)}
          </p>
          <p className={analysis.change >= 0 ? 'mt-1 text-sm text-green-400' : 'mt-1 text-sm text-red-400'}>
            {analysis.change >= 0 ? '+' : ''}{formatPrice(analysis.change)} ({analysis.change_percent}%)
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">Day High</p>
          <p className="mt-1 text-2xl font-bold text-green-400 tabular-nums">{formatPrice(analysis.high)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">Day Low</p>
          <p className="mt-1 text-2xl font-bold text-red-400 tabular-nums">{formatPrice(analysis.low)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">Open P&L</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${(stats?.open_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatSigned(stats?.open_pnl || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentCard
          icon={<BiasIcon className={`h-5 w-5 ${biasColor}`} />}
          title="Market Sentiment"
          agent="market_agent"
          tone={analysis.bias}
          rows={[
            ['Bias', <span className={`capitalize font-semibold ${biasColor}`}>{analysis.bias}</span>],
            ['Confidence', <ConfidenceBar value={analysis.confidence} />],
            ['Range Position', `${analysis.range_position}%`],
            ['Momentum', <span className={analysis.momentum >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{analysis.momentum}%</span>],
          ]}
        />
        <AgentCard
          icon={<AlertTriangle className={`h-5 w-5 ${volatilityColor(analysis.vix_context?.market_volatility)}`} />}
          title="VIX Analysis"
          agent="vix_agent"
          tone={analysis.vix_context?.market_volatility}
          rows={[
            ['VIX Value', <span className="font-semibold">{analysis.vix_context?.vix}</span>],
            ['Volatility', <span className={`font-semibold ${volatilityColor(analysis.vix_context?.market_volatility)}`}>{analysis.vix_context?.market_volatility}</span>],
            ['Risk Multiplier', `${analysis.vix_context?.risk_multiplier}x`],
          ]}
        />
        <AgentCard
          icon={<Zap className="h-5 w-5 text-blue-400" />}
          title="Trade Decision"
          agent="trader_agent"
          tone="blue"
          rows={[
            ['Action', <span className={`font-bold ${actionColor(analysis.trade_decision?.action)}`}>{analysis.trade_decision?.action}</span>],
            ['Reasoning', <span className="text-gray-300">{analysis.trade_decision?.reason}</span>],
          ]}
        />
        <AgentCard
          icon={<AlertTriangle className={`h-5 w-5 ${analysis.risk?.trade_allowed ? 'text-green-400' : 'text-red-400'}`} />}
          title="Risk Assessment"
          agent="risk_agent"
          tone={analysis.risk?.trade_allowed ? 'bullish' : 'bearish'}
          rows={[
            ['Trade Allowed', analysis.risk?.trade_allowed ?
              <span className="badge-green">YES</span> :
              <span className="badge-red">NO</span>],
            ['Position Size', analysis.risk?.position_size],
            ['Risk Score', analysis.risk?.risk_score],
            ['Stop / Target', analysis.risk?.stop_loss ? `${formatPrice(analysis.risk.stop_loss)} / ${formatPrice(analysis.risk.target)}` : 'None'],
            ['Block Reason', analysis.risk?.block_reason || <span className="text-gray-600">None</span>],
          ]}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Open Paper Positions</h3>
          {openTrades.length > 0 && <span className="badge-blue">{openTrades.length}</span>}
        </div>
        <TradeTable trades={openTrades} />
      </div>

      {tradeResult && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white">Trade Result</h3>
          {tradeResult.trade_allowed === false ? (
            <div className="mt-3 rounded-lg border border-yellow-800/50 bg-yellow-950/30 p-4">
              <p className="text-sm font-medium text-yellow-400">Trade Blocked</p>
              <p className="mt-1 text-xs text-gray-400">{tradeResult.block_reason || tradeResult.reason}</p>
              <div className="mt-2 flex gap-3 text-[11px] text-gray-500">
                <span>Bias: <span className="text-gray-300">{tradeResult.bias}</span></span>
                <span>Confidence: <span className="text-gray-300">{tradeResult.confidence}%</span></span>
                <span>VIX: <span className="text-gray-300">{tradeResult.vix}</span></span>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <div className="flex items-center gap-3">
                <span className={`badge ${tradeResult.action === 'BUY_CALL' ? 'badge-green' : 'badge-red'}`}>{tradeResult.action}</span>
                <span className="text-lg font-bold text-white">
                  {tradeResult.strike ? Number(tradeResult.strike).toLocaleString('en-IN') : '—'}
                  <span className={`ml-1 text-xs font-bold ${tradeResult.option_type === 'CE' ? 'text-green-400' : 'text-red-400'}`}>{tradeResult.option_type}</span>
                </span>
                <span className="text-sm text-gray-400">Premium: ₹{Number(tradeResult.entry || tradeResult.entry_premium || 0).toFixed(2)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div><span className="text-gray-500">Lots</span><p className="font-semibold text-gray-200">{tradeResult.lots || tradeResult.position_size}</p></div>
                <div><span className="text-gray-500">Stop Loss</span><p className="font-semibold text-red-400">₹{Number(tradeResult.stop_loss || 0).toFixed(2)}</p></div>
                <div><span className="text-gray-500">Target</span><p className="font-semibold text-green-400">₹{Number(tradeResult.target || 0).toFixed(2)}</p></div>
                <div><span className="text-gray-500">Risk/Reward</span><p className="font-semibold text-gray-200">{tradeResult.risk_reward || '—'}</p></div>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">{tradeResult.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConfidenceBar({ value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-200">{value}%</span>
    </div>
  )
}

function AgentCard({ icon, title, agent, tone, rows }) {
  return (
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${toneBg(tone)}`}>{icon}</div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-gray-500">{agent}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="text-right text-gray-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function toneBg(tone) {
  if (tone === 'bullish' || tone === 'LOW') return 'bg-green-500/10'
  if (tone === 'bearish' || tone === 'HIGH') return 'bg-red-500/10'
  if (tone === 'blue') return 'bg-blue-500/10'
  return 'bg-yellow-500/10'
}

function volatilityColor(value) {
  if (value === 'LOW') return 'text-green-400'
  if (value === 'HIGH') return 'text-red-400'
  return 'text-yellow-400'
}

function actionColor(value) {
  if (value === 'BUY_CALL') return 'text-green-400'
  if (value === 'BUY_PUT') return 'text-red-400'
  return 'text-yellow-400'
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatSigned(value) {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${formatPrice(number)}`
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-56 rounded bg-gray-800" />
          <div className="mt-2 h-4 w-72 rounded bg-gray-800" />
        </div>
        <div className="h-10 w-44 rounded-lg bg-gray-800" />
      </div>
      <div className="card h-[420px] animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="mt-3 h-8 w-20 rounded bg-gray-800" />
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
