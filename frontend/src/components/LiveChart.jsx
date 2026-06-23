import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { api } from '../api/client'

const TIMEFRAMES = [
  { key: '1m', label: '1M' },
  { key: '5m', label: '5M' },
  { key: '15m', label: '15M' },
  { key: '1h', label: '1H' },
  { key: '1d', label: '1D' },
]

export default function LiveChart({ height = 440, className = '' }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const wsRef = useRef(null)
  const initDoneRef = useRef(false)

  const [timeframe, setTimeframe] = useState('1m')
  const [price, setPrice] = useState(null)
  const [change, setChange] = useState(0)
  const [changePct, setChangePct] = useState(0)
  const [connected, setConnected] = useState(false)
  const [crosshair, setCrosshair] = useState(null)
  const [marketClosed, setMarketClosed] = useState(false)

  useEffect(() => {
    if (!containerRef.current || initDoneRef.current) return
    initDoneRef.current = true

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#9ca3af',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(31, 41, 55, 0.4)' },
        horzLines: { color: 'rgba(31, 41, 55, 0.4)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(156,163,175,0.3)', width: 1, style: 2, labelBackgroundColor: '#374151' },
        horzLine: { color: 'rgba(156,163,175,0.3)', width: 1, style: 2, labelBackgroundColor: '#374151' },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) { setCrosshair(null); return }
      const c = param.seriesData.get(candleSeries)
      const v = param.seriesData.get(volumeSeries)
      if (c) setCrosshair({ time: param.time, ...c, volume: v?.value })
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    return () => { chart.remove(); chartRef.current = null; initDoneRef.current = false }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    let cancelled = false

    const load = async () => {
      try {
        const data = await api.getChart(timeframe)
        if (cancelled || !data.candles?.length) return
        candleSeriesRef.current?.setData(data.candles)
        volumeSeriesRef.current?.setData(
          data.candles.map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
          }))
        )
        setPrice(data.last_price)
        setChange(data.change)
        setChangePct(data.change_percent)
        chartRef.current?.timeScale().fitContent()
      } catch {}
    }

    load()

    let ws
    try {
      ws = api.connectChartFeed()
      wsRef.current = ws
      ws.onopen = () => {
        setConnected(true)
        try { ws.send(JSON.stringify({ timeframe })) } catch {}
      }
      ws.onclose = () => setConnected(false)
      ws.onerror = () => setConnected(false)
      ws.onmessage = (e) => {
        if (cancelled) return
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'snapshot' && msg.candles?.length) {
            candleSeriesRef.current?.setData(msg.candles)
            volumeSeriesRef.current?.setData(
              msg.candles.map(c => ({
                time: c.time, value: c.volume,
                color: c.close >= c.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
              }))
            )
            chartRef.current?.timeScale().fitContent()
            if (msg.market_closed !== undefined) setMarketClosed(msg.market_closed)
          }
          if (msg.candle) {
            candleSeriesRef.current?.update(msg.candle)
            volumeSeriesRef.current?.update({
              time: msg.candle.time, value: msg.candle.volume,
              color: msg.candle.close >= msg.candle.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
            })
          }
          if (msg.last_price != null) setPrice(msg.last_price)
          if (msg.change != null) setChange(msg.change)
          if (msg.change_percent != null) setChangePct(msg.change_percent)
          if (msg.market_closed !== undefined) setMarketClosed(msg.market_closed)
        } catch {}
      }
    } catch { setConnected(false) }

    return () => { cancelled = true; ws?.close() }
  }, [timeframe])

  const switchTF = (tf) => {
    if (tf === timeframe) return
    setTimeframe(tf)
    setCrosshair(null)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ timeframe: tf })) } catch {}
    }
  }

  const isUp = (change || 0) >= 0
  const dp = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className={`card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">NIFTY 50</span>
          <span className={`text-lg font-bold tabular-nums ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {crosshair ? dp(crosshair.close) : price != null ? dp(price) : '—'}
          </span>
          <span className={`text-xs font-medium tabular-nums ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{Number(change || 0).toFixed(2)} ({Number(changePct || 0).toFixed(2)}%)
          </span>
          {marketClosed && (
            <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">MARKET CLOSED</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {crosshair && (
            <div className="hidden items-center gap-3 text-[11px] tabular-nums text-gray-400 sm:flex">
              <span>O <span className="text-gray-200">{dp(crosshair.open)}</span></span>
              <span>H <span className="text-green-400">{dp(crosshair.high)}</span></span>
              <span>L <span className="text-red-400">{dp(crosshair.low)}</span></span>
              <span>C <span className={crosshair.close >= crosshair.open ? 'text-green-400' : 'text-red-400'}>{dp(crosshair.close)}</span></span>
              {crosshair.volume != null && <span>V <span className="text-blue-400">{crosshair.volume.toLocaleString()}</span></span>}
            </div>
          )}
          <div className="flex rounded-md bg-gray-800 p-0.5">
            {TIMEFRAMES.map(({ key, label }) => (
              <button key={key} onClick={() => switchTF(key)}
                className={`rounded px-2 py-1 text-[11px] font-semibold transition-all ${timeframe === key ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <span className={`h-1.5 w-1.5 rounded-full ${marketClosed ? 'bg-yellow-500' : connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} title={marketClosed ? 'Market closed' : connected ? 'Live' : 'Disconnected'} />
        </div>
      </div>
      <div ref={containerRef} style={{ height: `${height}px` }} />
    </div>
  )
}
