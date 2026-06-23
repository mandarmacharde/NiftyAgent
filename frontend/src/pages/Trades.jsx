import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import TradeTable from '../components/TradeTable'
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react'

export default function Trades() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  const fetchTrades = async () => {
    try {
      const data = filter === 'open'
        ? await api.getOpenTrades()
        : filter === 'closed'
        ? await api.getClosedTrades()
        : await api.getTrades()
      setTrades(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchTrades()
  }, [filter])

  useEffect(() => {
    let alive = true
    try {
      const ws = api.connectMarketFeed()
      wsRef.current = ws
      ws.onopen = () => alive && setConnected(true)
      ws.onclose = () => alive && setConnected(false)
      ws.onerror = () => alive && setConnected(false)
      ws.onmessage = () => { if (alive) fetchTrades() }
    } catch { /* silent */ }

    return () => {
      alive = false
      if (wsRef.current) wsRef.current.close()
    }
  }, [filter])

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? t.unrealized_pnl ?? 0), 0)
  const openCount = trades.filter(t => t.status === 'OPEN').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Trade History</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span>View and manage your paper trades</span>
            <span className="inline-flex items-center gap-1.5">
              {connected ? <Wifi className="h-3.5 w-3.5 text-green-400" /> : <WifiOff className="h-3.5 w-3.5 text-gray-600" />}
              <span className={connected ? 'text-green-400' : 'text-gray-600'}>Auto-refresh</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {trades.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">{trades.length} trades</span>
              {openCount > 0 && <span className="badge-blue">{openCount} open</span>}
              <span className={`font-semibold tabular-nums ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                Total: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
              </span>
            </div>
          )}
          <button onClick={fetchTrades} className="btn-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'open', label: 'Open', count: trades.filter(t => t.status === 'OPEN').length },
          { key: 'closed', label: 'Closed', count: trades.filter(t => t.status === 'CLOSED').length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`btn text-xs gap-2 ${
              filter === key
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === key ? 'bg-white/20' : 'bg-gray-700'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex flex-col items-center py-12">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm text-gray-500">{error}</p>
        </div>
      ) : loading ? (
        <div className="card animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-gray-800" />
          ))}
        </div>
      ) : (
        <TradeTable trades={trades} showReflection={true} />
      )}
    </div>
  )
}
