import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function PriceTicker({ compact = false }) {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [flash, setFlash] = useState(null)
  const [marketClosed, setMarketClosed] = useState(false)
  const prevPrice = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const tick = await api.getTick()
        if (alive && tick.analysis) {
          setData(tick.analysis)
          prevPrice.current = tick.analysis.last_price
        }
      } catch { /* silent */ }
    }

    load()

    try {
      const ws = api.connectMarketFeed()
      wsRef.current = ws

      ws.onopen = () => alive && setConnected(true)
      ws.onclose = () => alive && setConnected(false)
      ws.onerror = () => alive && setConnected(false)

      ws.onmessage = (event) => {
        if (!alive) return
        try {
          const state = JSON.parse(event.data)
          if (state.market_closed !== undefined) setMarketClosed(state.market_closed)
          if (state.analysis) {
            const newPrice = state.analysis.last_price
            if (prevPrice.current != null && newPrice !== prevPrice.current) {
              setFlash(newPrice > prevPrice.current ? 'up' : 'down')
              setTimeout(() => setFlash(null), 500)
            }
            prevPrice.current = newPrice
            setData(state.analysis)
          }
        } catch { /* silent */ }
      }
    } catch {
      setConnected(false)
    }

    const interval = setInterval(load, 15000)

    return () => {
      alive = false
      clearInterval(interval)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  if (!data) {
    return (
      <div className={`flex items-center gap-3 ${compact ? '' : 'card'}`}>
        <div className="h-6 w-32 animate-pulse rounded bg-gray-800" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
      </div>
    )
  }

  const isPositive = (data.change || 0) >= 0
  const Icon = isPositive ? TrendingUp : data.change < 0 ? TrendingDown : Minus

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-400">NIFTY</span>
        <span className={`text-xl font-bold tabular-nums transition-colors duration-300 ${
          flash === 'up' ? 'text-green-300' : flash === 'down' ? 'text-red-300' : 'text-white'
        }`}>
          {Number(data.last_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`flex items-center gap-1 text-sm font-medium tabular-nums ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}>
          <Icon className="h-3.5 w-3.5" />
          {isPositive ? '+' : ''}{Number(data.change).toFixed(2)} ({Number(data.change_percent).toFixed(2)}%)
        </span>
        {marketClosed && (
          <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">CLOSED</span>
        )}
        <span className={`h-1.5 w-1.5 rounded-full ${marketClosed ? 'bg-yellow-500' : connected ? 'bg-green-500' : 'bg-gray-600'}`} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="card">
        <p className="text-sm text-gray-400">NIFTY Live</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums transition-colors duration-300 ${
          flash === 'up' ? 'text-green-300' : flash === 'down' ? 'text-red-300' : 'text-white'
        }`}>
          {Number(data.last_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className={`mt-1 flex items-center gap-1 text-sm font-medium tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          <Icon className="h-3.5 w-3.5" />
          {isPositive ? '+' : ''}{Number(data.change).toFixed(2)} ({Number(data.change_percent).toFixed(2)}%)
        </p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-400">Day High</p>
        <p className="mt-1 text-2xl font-bold text-green-400 tabular-nums">{Number(data.high).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-400">Day Low</p>
        <p className="mt-1 text-2xl font-bold text-red-400 tabular-nums">{Number(data.low).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-400">Volume</p>
        <p className="mt-1 text-2xl font-bold text-blue-400 tabular-nums">{Number(data.volume || 0).toLocaleString('en-IN')}</p>
      </div>
    </div>
  )
}
