import { useState, useEffect } from 'react'
import { api } from '../api/client'
import TradeTable from '../components/TradeTable'
import StatCard from '../components/StatCard'
import { AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Trophy } from 'lucide-react'

export default function History() {
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTrades = async () => {
    setLoading(true)
    setError(null)
    try {
      const [closed, s] = await Promise.all([api.getClosedTrades(), api.getStats()])
      setTrades(closed)
      setStats(s)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrades()
  }, [])

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const wins = trades.filter(t => t.pnl > 0).length
  const losses = trades.filter(t => t.pnl <= 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Closed Trades</h2>
          <p className="mt-1 text-sm text-gray-500">Completed trades with P&L and reflections</p>
        </div>
        <button onClick={fetchTrades} className="btn-secondary">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!loading && stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Closed"
            value={trades.length}
            icon={Trophy}
            color="blue"
          />
          <StatCard
            label="Wins / Losses"
            value={`${wins} / ${losses}`}
            icon={Trophy}
            color={wins >= losses ? 'green' : 'red'}
          />
          <StatCard
            label="Net P&L"
            value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`}
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
            color={totalPnl >= 0 ? 'green' : 'red'}
          />
          <StatCard
            label="Avg P&L"
            value={trades.length ? `${(totalPnl / trades.length >= 0 ? '+' : '')}${(totalPnl / trades.length).toFixed(2)}` : '—'}
            icon={Trophy}
            color="yellow"
          />
        </div>
      )}

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

      {!loading && trades.length === 0 && !error && (
        <div className="card py-16 text-center">
          <Trophy className="mx-auto h-12 w-12 text-gray-700" />
          <h3 className="mt-4 text-lg font-semibold text-gray-400">No closed trades yet</h3>
          <p className="mt-2 text-sm text-gray-600">Execute and close paper trades to see history here</p>
        </div>
      )}
    </div>
  )
}
