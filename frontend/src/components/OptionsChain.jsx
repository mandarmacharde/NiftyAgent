import { useState, useEffect, useRef, memo } from 'react'
import { api } from '../api/client'
import { RefreshCw, ChevronDown, Calendar } from 'lucide-react'

function OptionsChain({ height = 520, className = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedExpiry, setSelectedExpiry] = useState(null)
  const [showExpiryDrop, setShowExpiryDrop] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowExpiryDrop(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchChain = async (expiry) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getOptionChain(expiry || selectedExpiry)
      setData(res)
      if (!selectedExpiry && res.expiry_dates?.length) {
        setSelectedExpiry(res.selected_expiry || res.expiry_dates[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchChain() }, [])

  const handleExpiryChange = (exp) => {
    setSelectedExpiry(exp)
    setShowExpiryDrop(false)
    fetchChain(exp)
  }

  if (loading) return (
    <div className={`card overflow-hidden p-0 ${className}`} style={{ minHeight: `${height}px` }}>
      <div className="flex h-full items-center justify-center" style={{ minHeight: `${height - 4}px` }}>
        <div className="text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-600" />
          <p className="mt-2 text-xs text-gray-500">Loading option chain...</p>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className={`card overflow-hidden p-0 ${className}`} style={{ minHeight: `${height}px` }}>
      <div className="flex h-full items-center justify-center" style={{ minHeight: `${height - 4}px` }}>
        <div className="text-center">
          <p className="text-sm text-red-400">Failed to load option chain</p>
          <p className="mt-1 text-xs text-gray-600">{error}</p>
          <button onClick={() => fetchChain()} className="btn-secondary mt-3 text-xs">Retry</button>
        </div>
      </div>
    </div>
  )

  if (!data) return null

  const spot = data.spot || 0
  const strikes = data.strikes || []
  const pcr = data.pcr || 0
  const atm = strikes.reduce((closest, s) => Math.abs(s.strike - spot) < Math.abs(closest.strike - spot) ? s : closest, strikes[0])
  const atmStrike = atm?.strike || 0
  const nearStrikes = strikes.filter(s => Math.abs(s.strike - spot) <= spot * 0.04)

  const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const fmtOi = (v) => {
    const n = Number(v || 0)
    if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr'
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  return (
    <div className={`card overflow-hidden p-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-3 py-2 sm:px-5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-white">NIFTY Options</h3>
          <span className="text-[11px] text-gray-500">Spot <span className="font-semibold text-gray-300">{fmt(spot)}</span></span>
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${pcr >= 1 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
            PCR {pcr}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={dropRef}>
            <button onClick={() => setShowExpiryDrop(!showExpiryDrop)}
              className="flex items-center gap-1.5 rounded-md bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-700 transition-colors">
              <Calendar className="h-3 w-3 text-gray-500" />
              {selectedExpiry || 'Expiry'}
              <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${showExpiryDrop ? 'rotate-180' : ''}`} />
            </button>
            {showExpiryDrop && (
              <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-gray-700 bg-gray-900 shadow-xl">
                {(data.expiry_dates || []).map(exp => (
                  <button key={exp} onClick={() => handleExpiryChange(exp)}
                    className={`block w-full px-3 py-2 text-left text-[11px] transition-colors hover:bg-gray-800 ${
                      exp === selectedExpiry ? 'bg-brand-600/20 text-brand-400 font-semibold' : 'text-gray-300'
                    }`}>
                    {exp}
                    {data.days_to_expiry && exp === selectedExpiry && (
                      <span className="ml-1 text-[10px] text-gray-500">({data.days_to_expiry}d)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => fetchChain()} className="text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-gray-800 text-[11px]">
        <div className="flex items-center justify-between border-r border-gray-800 px-3 py-1.5">
          <span className="text-green-400 font-medium">CE OI</span>
          <span className="font-bold text-green-400 tabular-nums">{fmtOi(data.total_ce_oi)}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-red-400 font-medium">PE OI</span>
          <span className="font-bold text-red-400 tabular-nums">{fmtOi(data.total_pe_oi)}</span>
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight: `${height - 100}px` }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-gray-900">
            <tr className="text-[9px] uppercase tracking-wider text-gray-500">
              <th className="px-2 py-1.5 text-right font-medium">CE OI</th>
              <th className="px-2 py-1.5 text-right font-medium">CE Vol</th>
              <th className="px-2 py-1.5 text-right font-medium">CE LTP</th>
              <th className="px-2 py-1.5 text-center font-bold text-white min-w-[72px] bg-gray-800/50">Strike</th>
              <th className="px-2 py-1.5 text-left font-medium">PE LTP</th>
              <th className="px-2 py-1.5 text-left font-medium">PE Vol</th>
              <th className="px-2 py-1.5 text-left font-medium">PE OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/30">
            {nearStrikes.map(({ strike, ce, pe }) => {
              const isAtm = strike === atmStrike
              const ceLtp = ce?.ltp || 0
              const peLtp = pe?.ltp || 0
              return (
                <tr key={strike} className={`transition-colors hover:bg-gray-800/20 ${isAtm ? 'bg-brand-600/5 border-y border-brand-600/20' : ''}`}>
                  <td className="px-2 py-1 text-right tabular-nums text-green-400/80">{ce ? fmtOi(ce.oi) : '—'}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-gray-500">{ce ? fmtOi(ce.volume) : '—'}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-semibold text-gray-200">{ce ? fmt(ceLtp) : '—'}</td>
                  <td className={`px-2 py-1 text-center font-bold tabular-nums ${isAtm ? 'text-brand-400 bg-gray-800/60' : 'text-gray-300'}`}>
                    {fmt(strike)}
                    {isAtm && <span className="ml-0.5 text-[8px] text-brand-400 align-top">ATM</span>}
                  </td>
                  <td className="px-2 py-1 text-left tabular-nums font-semibold text-gray-200">{pe ? fmt(peLtp) : '—'}</td>
                  <td className="px-2 py-1 text-left tabular-nums text-gray-500">{pe ? fmtOi(pe.volume) : '—'}</td>
                  <td className="px-2 py-1 text-left tabular-nums text-red-400/80">{pe ? fmtOi(pe.oi) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(OptionsChain)
